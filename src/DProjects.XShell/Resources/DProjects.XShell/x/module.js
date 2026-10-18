// constants
const themes = ["system", "light", "dark"];
const themeIcons = { system: "x-monitor", light: "x-sun", dark: "x-moon" };

// export
export default class {
    load() {
        // load
        debugger;
        alert(1)
    }
    toggleTheme() {
        // toggle theme
        debugger;
        const savedTheme = localStorage.getItem("xshell.theme");
        state.theme = themes.includes(savedTheme) ? savedTheme : "system";
        state.themeIcon = themeIcons[state.theme];
        applyTheme(state.theme);
        debugger;
    }
    applyTheme(theme) {
        if (theme === "system") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", theme);
    }
}