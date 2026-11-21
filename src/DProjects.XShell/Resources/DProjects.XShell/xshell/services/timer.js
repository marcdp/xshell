// class
export default class Timer {

    // Options schema for the Timer class
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    // vars
    _handler = null;
    _timeouts = [];
    _intervals = [];

    // ctor
    constructor(dependencies = {}, options = {}) {
        // preserve supported direct construction while accepting standard Services dependencies
        this._handler = typeof dependencies === "function" ? dependencies : dependencies.scopeContext?.invokeController ?? null;
    }

    dispose() {
        // Clear pending timeouts
        for (const { timeoutId } of this._timeouts) {
            clearTimeout(timeoutId);
        }
        this._timeouts = [];

        // Clear active intervals
        for (const { intervalId } of this._intervals) {
            clearInterval(intervalId);
        }
        this._intervals = [];
        this._handler = null;
    }

    // methods
    setTimeout(listener, timeout) {
        // Resolve command listeners
        if (typeof listener === "string") {
            if (typeof this._handler !== "function") throw new Error("Timer string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => this._handler(command);
        }

        // Schedule and track the timeout
        const timeoutId = setTimeout(() => {
            this._timeouts = this._timeouts.filter(t => t.timeoutId !== timeoutId);
            listener();
        }, timeout);

        this._timeouts.push({ timeoutId });
        return timeoutId;
    }

    setInterval(listener, timeout) {
        // Resolve command listeners
        if (typeof listener === "string") {
            if (typeof this._handler !== "function") throw new Error("Timer string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => this._handler(command);
        }

        // Schedule and track the interval
        const intervalId = setInterval(listener, timeout);
        this._intervals.push({ intervalId });
        return intervalId;
    }
}
