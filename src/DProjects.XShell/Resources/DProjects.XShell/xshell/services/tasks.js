
const MAX_OUTPUT_ENTRIES = 5000;
const MAX_OUTPUT_PAGE = 1000;
const TERMINAL_STATUSES = new Set(["finished", "error", "canceled"]);

class Task extends EventTarget {

    // fields
    #id;
    #title;
    #description;
    #background;
    #status = "pending";
    #progress = null;
    #error = null;
    #createdAt = new Date();
    #startedAt = null;
    #endedAt = null;
    #startedPerformance = null;
    #duration = null;
    #controller = new AbortController();
    #output = [];
    #outputStart = 0;
    #result;
    #failure;
    #done;
    #resolveDone;
    #onChange;
    #logger;

    // ctor
    constructor({id, title, description, background, onChange, logger}) {
        super();
        this.#id = id;
        this.#title = title;
        this.#description = description;
        this.#background = background;
        this.#onChange = onChange;
        this.#logger = logger;
        this.#done = new Promise(resolve => { this.#resolveDone = resolve; });
    }

    // properties
    get id() { return this.#id; }
    get title() { return this.#title; }
    get description() { return this.#description; }
    get background() { return this.#background; }
    get status() { return this.#status; }
    get progress() { return this.#progress; }
    get error() { return this.#error; }
    get createdAt() { return new Date(this.#createdAt); }
    get startedAt() { return this.#startedAt && new Date(this.#startedAt); }
    get endedAt() { return this.#endedAt && new Date(this.#endedAt); }
    get duration() {
        if (this.#duration !== null) return this.#duration;
        if (this.#startedPerformance === null) return null;
        return performance.now() - this.#startedPerformance;
    }

    // methods
    async wait() {
        await this.#done;
    }

    async getResult() {
        await this.wait();
        if (this.#status === "finished") return this.#result;
        throw this.#failure;
    }

    async getOutput({cursor, limit = 100} = {}) {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_OUTPUT_PAGE) {
            throw new RangeError(`Output limit must be between 1 and ${MAX_OUTPUT_PAGE}`);
        }

        let offset = cursor === undefined ? this.#outputStart : Number(cursor);
        if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new TypeError("Output cursor must be a non-negative integer");
        }

        offset = Math.max(this.#outputStart, Math.min(offset, this.#outputStart + this.#output.length));
        const entries = this.#output.slice(offset - this.#outputStart, offset - this.#outputStart + limit)
            .map(entry => ({...entry, timestamp: new Date(entry.timestamp)}));

        return {entries, nextCursor: String(offset + entries.length)};
    }

    async cancel() {
        // Keep cancellation on its existing boundary.
        if (!TERMINAL_STATUSES.has(this.#status)) {
            const wasAborted = this.#controller.signal.aborted;
            this.#controller.abort();
            if (!wasAborted) this.#logger.debug("Tasks: cancellation requested", {taskId: this.id, status: this.status, background: this.background});
        }
    }

    // internal methods
    get _signal() { return this.#controller.signal; }

    _start() {
        this.#status = "running";
        this.#startedAt = new Date();
        this.#startedPerformance = performance.now();
        this.#notify();
    }

    _setDescription(value) {
        if (this.#status !== "running" || this._signal.aborted) return;
        if (typeof value !== "string") throw new TypeError("Description must be a string");

        this.#description = value;
        this.#notify();
    }

    _setProgress(value, max = 100) {
        if (this.#status !== "running" || this._signal.aborted) return;

        if (value === null) {
            this.#progress = null;
        } else {
            if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value < 0 || value > max) {
                throw new RangeError("Progress must satisfy 0 <= value <= max and max > 0");
            }
            this.#progress = Object.freeze({value, max});
        }

        this.#notify();
    }

    _write(level, text) {
        if (this.#status !== "running" || this._signal.aborted) return;

        this.#output.push(Object.freeze({timestamp: new Date(), level, text: String(text)}));

        if (this.#output.length > MAX_OUTPUT_ENTRIES) {
            this.#output.shift();
            this.#outputStart++;
        }

        this.#notify();
    }

    _finish(result) {
        this.#result = result;
        this.#complete("finished");
    }

    _fail(error) {
        if (this._signal.aborted) {
            this.#failure = new DOMException("Task canceled", "AbortError");
            this.#complete("canceled");
        } else {
            this.#failure = error instanceof Error ? error : new Error(String(error?.message ?? error));
            const code = error?.code;

            this.#error = Object.freeze({
                message: this.#failure.message,
                ...(typeof code === "string" || typeof code === "number" ? {code} : {}),
                ...(this.#failure.stack ? {stack: this.#failure.stack} : {})
            });

            // Record the unhandled exception in the Task output.
            this._write("error", this.#failure.message);

            this.#complete("error");
        }
    }

    #complete(status) {
        this.#status = status;
        this.#endedAt = new Date();
        this.#duration = this.#startedPerformance === null ? 0 : performance.now() - this.#startedPerformance;
        this.#notify();
        this.#resolveDone();
    }

    #notify() {
        this.#onChange(this);
        this.dispatchEvent(new Event("change"));
    }
}

export default class Tasks {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    // vars
    #bus;
    #logger;
    #tasks = [];

    // ctor
    constructor({bus, logger}) {
        this.#bus = bus;
        this.#logger = logger;
    }

    // methods
    run({title, description = "", background = true, handler, data, logFailure = true} = {}) {
        if (typeof title !== "string" || !title.trim()) throw new TypeError("Task title must be a non-empty string");
        if (typeof description !== "string") throw new TypeError("Task description must be a string");
        if (typeof background !== "boolean") throw new TypeError("Task background must be a boolean");
        if (typeof handler !== "function") throw new TypeError("Task handler must be a function");

        const task = new Task({
            id: crypto.randomUUID(),
            title,
            description,
            background,
            logger: this.#logger,
            onChange: task => this.#bus?.emit("xshell:tasks:updated", {id: task.id, status: task.status})
        });

        this.#tasks.unshift(task);
        this.#bus?.emit("xshell:tasks:added", {id: task.id});
        const taskId = task.id;
        this.#logger.trace("Tasks: created", {taskId, background});

        // Start asynchronously so run() returns the task immediately.
        Promise.resolve().then(async () => {
            try {
                task._signal.throwIfAborted();
                task._start();
                this.#logger.debug("Tasks: execution started", {taskId, background, status: task.status});

                const result = await handler({
                    data,
                    signal: task._signal,
                    setDescription: description => task._setDescription(description),
                    setProgress: (value, max = 100) => task._setProgress(value, max),
                    log: text => task._write("log", text),
                    info: text => task._write("info", text),
                    warn: text => task._write("warn", text),
                    error: text => task._write("error", text)
                });

                task._signal.throwIfAborted();
                task._finish(result);
            } catch (error) {
                task._fail(error);
            }

            // Diagnose the terminal status. An operation owner can report its own failure details.
            const {status, duration} = task;
            const metadata = {taskId, background, status, duration};
            if (status === "finished") this.#logger.debug("Tasks: execution completed", metadata);
            else if (status === "canceled") this.#logger.debug("Tasks: execution canceled", metadata);
            else if (logFailure) this.#logger.error("Tasks: execution failed", metadata);
        });

        return task;
    }

    get(id) {
        return this.#tasks.find(task => task.id === id);
    }

    list() {
        return [...this.#tasks];
    }

    clear() {
        for (const task of this.#tasks.filter(task => TERMINAL_STATUSES.has(task.status))) {
            this.remove(task.id);
        }
    }

    remove(id) {
        const index = this.#tasks.findIndex(task => task.id === id);
        if (index < 0) return;

        if (!TERMINAL_STATUSES.has(this.#tasks[index].status)) {
            throw new Error("Cannot remove a task that is not finished");
        }

        this.#tasks.splice(index, 1);
        this.#bus?.emit("xshell:tasks:removed", {id});
        this.#logger.trace("Tasks: removed", {taskId: id});
    }
}
