
export default {
    contract: {
        description: "",
        events: {},
        properties: {},
        methods: {}
    },
    meta: { title: "Internationalization" },
    style: `
        :scope {display:block;}
        x-datafield {margin-top: .25em;}
    `,
    template: `
        <x-datafield type="select" label="Language" x-prop:domain="state.languages" x-model="state.language"></x-datafield>
    `,
    state: {
        language: "en",
        languages: []
    },
    controller({state, events, theme, i18n, bus}) {
        return {
            load() {
                // load
                state.language = i18n.getDefaultLang();
                state.languages = i18n.config.langs.map(lang => ({value:lang.id, label:lang.label}));
                events.on(state, "change:language", ()=>{
                    i18n.setLanguage(state.language);
                });
            },
        };
    }
};
