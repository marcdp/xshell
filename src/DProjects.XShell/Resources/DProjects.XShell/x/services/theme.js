const MODES = Object.freeze(["system", "light", "dark"]);

export default class Theme {

    // fields
    _bus = null;
    _mode = "system";

    // props
    get mode() { return this._mode; }

    // ctor
    constructor({ bus }) {
        this._bus = bus;

        const saved = localStorage.getItem("xshell.theme");
        this._mode = MODES.includes(saved) ? saved : "system";
        this._applyMode();
    }

    // methods
    getModes() {
        return [...MODES];
    }
    setMode(mode) {
        if (!MODES.includes(mode) || mode === this._mode) return;

        this._mode = mode;
        this._applyMode();
        localStorage.setItem("xshell.theme", mode);
        this._bus.emit("xshell:theme:change", { theme: mode });
    }
    toggleMode() {
        const index = MODES.indexOf(this._mode);
        this.setMode(MODES[(index + 1) % MODES.length]);
    }

    // methods (private)
    _applyMode() {
        if (this._mode === "system") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", this._mode);
        }
    }
}
