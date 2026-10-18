
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
        x-datafield + x-datafield {margin-top: .25em;}
    `,
    template: `
        <x-datafield class="horizontal segmented" type="radios" label="Theme" x-prop:domain="state.themes" x-model="state.theme"></x-datafield>
        <x-datafield class="horizontal segmented" type="select" label="Language" x-prop:domain="state.languages" x-model="state.language"></x-datafield>
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
    controller({state, events, i18n, moduleController}) {
        return {
            load() {
                debugger;
                // theme
                const savedTheme = localStorage.getItem("xshell.theme");
                state.theme = moduleController.getThemes().includes(savedTheme) ? savedTheme : "system";
                state.language = i18n.getDefaultLang();
                state.languages = i18n.config.langs.map(lang => ({value:lang.id, label:lang.id.toUpperCase()}));
                events.on(state, "change:theme", ()=>{
                    moduleController.setTheme(state.theme);
                });
                // language
                events.on(state, "change:language", ()=>{
                    i18n.setLanguage(state.language);
                });
            },
        };
    }
};
