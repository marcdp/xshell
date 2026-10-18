
export default class Module {

    // const
    static THEMES = ["system", "light", "dark"];

    // ctor
    constructor({ bus }) {
        this._bus = bus;
        this._theme = "system";
    }

    // start
    async start() {
        const saved = localStorage.getItem("xshell.theme");
        this.setTheme(Module.THEMES.includes(saved) ? saved : "system");
        
    }

    // methods
    getThemes() {
        return Module.THEMES;
    }
    setTheme(theme) {
        if (!Module.THEMES.includes(theme)) return;

        this._theme = theme;
        if (theme === "system") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", theme);

        localStorage.setItem("xshell.theme", theme);
        this._bus.emit("xshell:theme:change", { theme });
    }

    toggleTheme() {
        const index = Module.THEMES.indexOf(this._theme);
        this.setTheme(Module.THEMES[(index + 1) % Module.THEMES.length]);
    }
}