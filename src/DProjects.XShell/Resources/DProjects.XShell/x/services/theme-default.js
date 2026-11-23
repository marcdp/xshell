const MODES = Object.freeze(["system", "light", "dark"]);

export default class Theme {

    // options
    static optionsSchema = {
        type: "object",
        properties: {
        },
        additionalProperties: false
    };

    // fields
    #bus = null;
    #preferences = null;
    #mode = "system";
    #revision = 0;
    #pendingWrite = Promise.resolve();

    // props
    get mode() { return this.#mode; }

    // ctor
    constructor({ bus, preferences }, options) {
        this.#bus = bus;
        this.#preferences = preferences;
        this.#applyMode();
        this.#restoreMode();
    }

    // methods
    getModes() {
        return [...MODES];
    }
    setMode(mode) {
        if (!MODES.includes(mode) || mode === this.#mode) return;

        this.#mode = mode;
        this.#revision++;
        this.#applyMode();
        // Serialize writes so rapid selections leave the latest mode in storage.
        this.#pendingWrite = this.#pendingWrite.then(() => this.#preferences.set("xshell.theme", mode)).catch(() => {});
        this.#bus.emit("x:theme:changed", { mode });
    }
    toggleMode() {
        const index = MODES.indexOf(this.#mode);
        this.setMode(MODES[(index + 1) % MODES.length]);
    }

    // methods (private)
    async #restoreMode() {
        // Ignore a delayed read if a user has already selected a newer mode.
        try {
            const saved = await this.#preferences.get("xshell.theme", "system");
            if (this.#revision || !MODES.includes(saved) || saved === this.#mode) return;
            this.#mode = saved;
            this.#applyMode();
            this.#bus.emit("x:theme:changed", { mode: saved });
        } catch { }
    }
    #applyMode() {
        if (this.#mode === "system") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", this.#mode);
        }
    }
}
