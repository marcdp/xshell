
export default class Tasks {

    // vars
    _bus = null;
    _tasks = [];
    _nextId = 0;

    // ctor
    constructor({bus}) {
        this._bus = bus;
    }

    // properties
    get tasks() {
        return this.getTasks();
    }

    // methods
    run(name, description, action) {
        if (typeof name !== "string" || !name.trim()) throw new TypeError("Task name must be a non-empty string");
        if (typeof description !== "string") throw new TypeError("Task description must be a string");
        if (typeof action !== "function") throw new TypeError("Task action must be a function");

        const controller = new AbortController();
        const task = {
            id: ++this._nextId,
            name,
            description,
            status: "running",
            progress: null,
            error: null,
            started: Date.now(),
            finished: null,
            controller,
            promise: null
        };

        this._tasks.unshift(task);
        this._notify(task);

        // Start asynchronously, allowing the caller to receive the task immediately.
        task.promise = Promise.resolve().then(async () => {
            try {
                controller.signal.throwIfAborted();

                const result = await action({
                    signal: controller.signal,
                    setDescription: value => {
                        if (task.status !== "running" || controller.signal.aborted) return;
                        task.description = String(value);
                        this._notify(task);
                    },
                    setProgress: value => {
                        if (task.status !== "running" || controller.signal.aborted) return;
                        if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
                            throw new RangeError("Task progress must be between 0 and 100, or null");
                        }
                        task.progress = value;
                        this._notify(task);
                    }
                });

                controller.signal.throwIfAborted();
                task.status = "ok";
                task.progress = 100;
                return result;
            } catch (error) {
                if (controller.signal.aborted) {
                    task.status = "aborted";
                } else {
                    task.status = "error";
                    task.error = error?.message || String(error);
                }
                throw error;
            } finally {
                task.finished = Date.now();
                this._notify(task);
            }
        });

        // Prevent an unhandled rejection when the caller does not await task.promise.
        task.promise.catch(() => {});

        return task;
    }

    getTasks() {
        return this._tasks.map(task => this._snapshot(task));
    }

    getTask(id) {
        const task = this._tasks.find(task => task.id === id);
        return task ? this._snapshot(task) : null;
    }

    abort(id) {
        const task = this._tasks.find(task => task.id === id);
        if (!task || task.status !== "running" || task.controller.signal.aborted) return;
        task.controller.abort();
    }

    clear() {
        const removed = this._tasks.filter(task => task.status !== "running");
        this._tasks = this._tasks.filter(task => task.status === "running");

        for (const task of removed) this._notify(task);
    }

    // private methods
    _snapshot(task) {
        return {
            id: task.id,
            name: task.name,
            description: task.description,
            status: task.status,
            progress: task.progress,
            error: task.error,
            started: task.started,
            finished: task.finished
        };
    }

    _notify(task) {
        this._bus.emit("xshell:tasks:change", {
            id: task.id,
            status: task.status
        });
    }
}
