
export const contract = {
    description: "Application settings",
    events: {},
    properties: {},
    methods: {}
};

export default {
    meta: { title: "Settings" },
    style: `
        :scope {display:block;}
    `,
    template: `
        <x-datafields>
            <x-datafield class="horizontal segmented" type="radios" label="Theme" x-prop:domain="state.themes" x-model="state.theme"></x-datafield>
            <x-datafield class="horizontal segmented" type="select" label="Language" x-prop:domain="state.languages" x-model="state.language"></x-datafield>
        </x-datafields>
    `,
    state: {
        theme: "system",
        language: "en",
        themes: [
            {value:"system", label:"System"},
            {value:"light", label:"Light"},
            {value:"dark", label:"Dark"}
        ],
        languages: []
    },
    controller({state, events, i18n}) {
        return {
            load() {
                const savedTheme = localStorage.getItem("xshell.theme");
                state.theme = ["system", "light", "dark"].includes(savedTheme) ? savedTheme : "system";
                state.language = i18n.getDefaultLang();
                state.languages = i18n.config.langs.map(lang => ({value:lang.id, label:lang.id.toUpperCase()}));

                events.on(state, "change:theme", "changeTheme");
                events.on(state, "change:language", "changeLanguage");
            },

            changeTheme() {
                localStorage.setItem("xshell.theme", state.theme);
                if (state.theme === "system") document.documentElement.removeAttribute("data-theme");
                else document.documentElement.setAttribute("data-theme", state.theme);
            },

            changeLanguage() {
                localStorage.setItem("xshell.language", state.language);
                window.location.reload();
            }
        };
    }
};
