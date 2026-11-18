export default class Runtime {

    // options schema for runtime service configuration
    static optionsSchema = {
        type: "object",
        additionalProperties: false
    };

    // ctor
    constructor({ timing }) {
        this._timing = timing;
    }

    // props
    get startTimeMs() {
        return this._timing.startTimeMs;
    }
    get startupDurationMs() {
        return this._timing.timings.find(
            item => item.phase === "xshell initialized"
        )?.totalMs ?? null;
    }
    get uptimeMs() {
        return performance.now() - this._timing.started;
    }
    get timings() {
        return this._timing.timings.map(item => ({ ...item }));
    }
}