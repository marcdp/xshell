
export default {
    contract: {
        description: "Appearance",
        events: {},
        properties: {},
        methods: {}
    },
    meta: { title: "Appearance" },
    style: `
        :scope {display:block;}
        x-datafield {margin-top: .25em;}
    `,
    template: `
        <x-datafield type="radios" label="Theme" x-prop:domain="state.themes" x-model="state.theme"></x-datafield>
    `,
    state: {
        theme: "system",
        themes: [],
    },
    controller({state, events, theme, i18n, bus}) {
        return {
            load() {
                // theme
                state.theme = theme.mode;
                state.themes = theme.getModes().map(mode => ({
                    value: mode,
                    label: mode.charAt(0).toUpperCase() + mode.slice(1)
                }));
                events.on(state, "change:theme", ()=>{
                    theme.setMode(state.theme);
                });
                // Keep the selection current when the theme preference finishes loading.
                events.on(bus, "x:theme:changed", () => { state.theme = theme.mode; });

            },
        };
    }
};
