
const MAX_OUTPUT_ENTRIES = 5000;
const MAX_OUTPUT_PAGE = 1000;
const TERMINAL_STATUSES = new Set(["finished", "error", "canceled"]);

class Task extends EventTarget {
    #id;
    #title;
    #description;
    #status = "pending";
    #progress = null;
    #error = null;
    #createdAt = new Date();
    #startedAt = null;
    #endedAt = null;
    #controller = new AbortController();
    #output = [];
    #outputStart = 0;
    #result;
    #failure;
    #done;
    #resolveDone;
    #onChange;

    constructor({id, title, description, onChange}) {
        super();
        this.#id = id;
        this.#title = title;
        this.#description = description;
        this.#onChange = onChange;
        this.#done = new Promise(resolve => { this.#resolveDone = resolve; });
    }

    // properties
    get id() { return this.#id; }
    get title() { return this.#title; }
    get description() { return this.#description; }
    get status() { return this.#status; }
    get progress() { return this.#progress; }
    get error() { return this.#error; }
    get createdAt() { return new Date(this.#createdAt); }
    get startedAt() { return this.#startedAt && new Date(this.#startedAt); }
    get endedAt() { return this.#endedAt && new Date(this.#endedAt); }

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
        if (!TERMINAL_STATUSES.has(this.#status)) this.#controller.abort();
    }

    // internal methods
    get _signal() { return this.#controller.signal; }

    _start() {
        this.#status = "running";
        this.#startedAt = new Date();
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

    _write(channel, text) {
        if (this.#status !== "running" || this._signal.aborted) return;

        this.#output.push(Object.freeze({timestamp: new Date(), channel, text: String(text)}));

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

            this.#complete("error");
        }
    }

    #complete(status) {
        this.#status = status;
        this.#endedAt = new Date();
        this.#notify();
        this.#resolveDone();
    }

    #notify() {
        this.#onChange(this);
        this.dispatchEvent(new Event("change"));
    }
}

export default class Tasks {
    _bus;
    _tasks = [];

    // ctor
    constructor({bus}) {
        this._bus = bus;
    }

    // methods
    run({title, description = "", handler, data} = {}) {
        if (typeof title !== "string" || !title.trim()) throw new TypeError("Task title must be a non-empty string");
        if (typeof description !== "string") throw new TypeError("Task description must be a string");
        if (typeof handler !== "function") throw new TypeError("Task handler must be a function");

        const task = new Task({
            id: crypto.randomUUID(),
            title,
            description,
            onChange: task => this._bus?.emit("xshell:tasks:updated", {id: task.id, status: task.status})
        });

        this._tasks.unshift(task);
        this._bus?.emit("xshell:tasks:added", {id: task.id});

        // Start asynchronously so run() returns the task immediately.
        Promise.resolve().then(async () => {
            try {
                task._signal.throwIfAborted();
                task._start();

                const result = await handler({
                    data,
                    signal: task._signal,
                    setDescription: description => task._setDescription(description),
                    setProgress: (value, max = 100) => task._setProgress(value, max),
                    write: text => task._write("stdout", text),
                    out: text => task._write("stdout", text),
                    err: text => task._write("stderr", text)
                });

                task._signal.throwIfAborted();
                task._finish(result);
            } catch (error) {
                task._fail(error);
            }
        });

        return task;
    }

    get(id) {
        return this._tasks.find(task => task.id === id);
    }

    list() {
        return [...this._tasks];
    }

    clear() {
        for (const task of this._tasks.filter(task => TERMINAL_STATUSES.has(task.status))) {
            this.remove(task.id);
        }
    }

    remove(id) {
        const index = this._tasks.findIndex(task => task.id === id);
        if (index < 0) return;

        if (!TERMINAL_STATUSES.has(this._tasks[index].status)) {
            throw new Error("Cannot remove a task that is not finished");
        }

        this._tasks.splice(index, 1);
        this._bus?.emit("xshell:tasks:removed", {id});
    }
}
