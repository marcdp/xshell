// class
export default class Timer {

    // Options schema for the Timer class
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    // vars
    #handler = null;
    #timeouts = [];
    #intervals = [];

    // ctor
    constructor(dependencies = {}, options = {}) {
        // preserve supported direct construction while accepting standard Services dependencies
        this.#handler = typeof dependencies === "function" ? dependencies : dependencies.scopeContext?.invokeController ?? null;
    }

    dispose() {
        // Clear pending timeouts
        for (const { timeoutId } of this.#timeouts) {
            clearTimeout(timeoutId);
        }
        this.#timeouts = [];

        // Clear active intervals
        for (const { intervalId } of this.#intervals) {
            clearInterval(intervalId);
        }
        this.#intervals = [];
        this.#handler = null;
    }

    // methods
    setTimeout(listener, timeout) {
        // Resolve command listeners
        if (typeof listener === "string") {
            if (typeof this.#handler !== "function") throw new Error("Timer string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => this.#handler(command);
        }

        // Schedule and track the timeout
        const timeoutId = setTimeout(() => {
            this.#timeouts = this.#timeouts.filter(t => t.timeoutId !== timeoutId);
            listener();
        }, timeout);

        this.#timeouts.push({ timeoutId });
        return timeoutId;
    }

    setInterval(listener, timeout) {
        // Resolve command listeners
        if (typeof listener === "string") {
            if (typeof this.#handler !== "function") throw new Error("Timer string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => this.#handler(command);
        }

        // Schedule and track the interval
        const intervalId = setInterval(listener, timeout);
        this.#intervals.push({ intervalId });
        return intervalId;
    }
}
