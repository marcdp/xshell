// class
export default class Timer {

    // vars
    _handler = null;
    _timeouts = [];
    _intervals = [];

    // ctor
    constructor(handler) {
        this._handler = handler;
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
    }

    // methods
    setTimeout(listener, timeout) {
        // Resolve command listeners
        if (typeof listener === "string") {
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
            const command = listener;
            listener = () => this._handler(command);
        }

        // Schedule and track the interval
        const intervalId = setInterval(listener, timeout);
        this._intervals.push({ intervalId });
        return intervalId;
    }
}