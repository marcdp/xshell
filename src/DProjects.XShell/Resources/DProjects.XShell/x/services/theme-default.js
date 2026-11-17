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
    _bus = null;
    _preferences = null;
    _mode = "system";
    _revision = 0;
    _pendingWrite = Promise.resolve();

    // props
    get mode() { return this._mode; }

    // ctor
    constructor({ bus, preferences }, options) {
        this._bus = bus;
        this._preferences = preferences;
        this._applyMode();
        this._restoreMode();
    }

    // methods
    getModes() {
        return [...MODES];
    }
    setMode(mode) {
        if (!MODES.includes(mode) || mode === this._mode) return;

        this._mode = mode;
        this._revision++;
        this._applyMode();
        // Serialize writes so rapid selections leave the latest mode in storage.
        this._pendingWrite = this._pendingWrite.then(() => this._preferences.set("xshell.theme", mode)).catch(() => {});
        this._bus.emit("x:theme:changed", { mode });
    }
    toggleMode() {
        const index = MODES.indexOf(this._mode);
        this.setMode(MODES[(index + 1) % MODES.length]);
    }

    // methods (private)
    async _restoreMode() {
        // Ignore a delayed read if a user has already selected a newer mode.
        try {
            const saved = await this._preferences.get("xshell.theme", "system");
            if (this._revision || !MODES.includes(saved) || saved === this._mode) return;
            this._mode = saved;
            this._applyMode();
            this._bus.emit("x:theme:changed", { mode: saved });
        } catch { }
    }
    _applyMode() {
        if (this._mode === "system") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", this._mode);
        }
    }
}
