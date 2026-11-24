
export default {
    contract: {
        description: "Appearance",
        events: {},
        properties: {},
        methods: {}
    },
    meta: { 
        title: "Appearance",
        description: "Customize the appearance of the application."
    },
    style: `
        :scope {display:block;}
    `,
    template: `
        <x-datafields>
            <x-datafield type="radios" label="Theme" x-prop:domain="state.themes" x-model="state.theme"></x-datafield>
        </x-datafields>
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
