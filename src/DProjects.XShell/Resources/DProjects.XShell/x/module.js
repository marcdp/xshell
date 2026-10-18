// constants
const themes = ["system", "light", "dark"];
const themeIcons = { system: "x-monitor", light: "x-sun", dark: "x-moon" };

// export
export default class {

    // vars
    _theme = "system";
    _themeIcon = themeIcons["system"];

    // methods
    start() {
        // start
        const savedTheme = localStorage.getItem("xshell.theme");
        this._theme = themes.includes(savedTheme) ? savedTheme : "system";
        this._themeIcon = themeIcons[this._theme];
        this.applyTheme(this._theme);
    }
    toggleTheme() {
        // toggle theme
        alert("TOGGLE")
        const savedTheme = localStorage.getItem("xshell.theme");
        this._theme = themes.includes(savedTheme) ? savedTheme : "system";
        this._themeIcon = themeIcons[this._theme];
        this.applyTheme(this._theme);
        debugger;
    }
    applyTheme(theme) {
        if (theme === "system") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", theme);
    }
}