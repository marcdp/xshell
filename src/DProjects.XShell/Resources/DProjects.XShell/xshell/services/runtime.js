export default class Runtime {

    // options schema for runtime service configuration
    static optionsSchema = {
        type: "object",
        additionalProperties: false
    };

    // vars    
    #timings = null;

    // ctor
    constructor({ bus, timings }) {
        // constructor
        this.#timings = timings;
        // record first navigation end timing
        const onFirstPageLoaded = () => {
            this.record("xshell:navigation:end");
            bus.removeEventListener("xshell:navigation:end", onFirstPageLoaded);
        };
        bus.addEventListener("xshell:navigation:end", onFirstPageLoaded);
        // Record the first successful main Page render
        const onFirstRender = () => {
            this.record("first page rendered");
            bus.removeEventListener("xshell:navigation:first-render", onFirstRender);
        };
        bus.addEventListener("xshell:navigation:first-render", onFirstRender);
    }

    // props
    get startTimeMs() {
        return this.#timings.startTimeMs;
    }
    get startupDurationMs() {
        return this.#timings.checkpoints.find(
            item => item.phase === "first page rendered"
        )?.totalMs ?? null;
    }
    get uptimeMs() {
        return performance.now() - this.#timings.started;
    }
    get timings() {
        return this.#timings.checkpoints.map(item => ({ ...item }));
    }

    // methods
    record(phase) {
        this.#timings.record(phase);
    }

}
