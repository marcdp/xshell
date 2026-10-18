
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
        themes: [],
        languages: []
    },
    controller({state, events, theme, i18n}) {
        return {
            load() {
                // theme
                state.theme = theme.mode;
                state.themes = theme.getModes().map(mode => ({
                    value: mode,
                    label: mode.charAt(0).toUpperCase() + mode.slice(1)
                }));
                state.language = i18n.getDefaultLang();
                state.languages = i18n.config.langs.map(lang => ({value:lang.id, label:lang.id.toUpperCase()}));
                events.on(state, "change:theme", ()=>{
                    theme.setMode(state.theme);
                });
                // language
                events.on(state, "change:language", ()=>{
                    i18n.setLanguage(state.language);
                });
            },
        };
    }
};
