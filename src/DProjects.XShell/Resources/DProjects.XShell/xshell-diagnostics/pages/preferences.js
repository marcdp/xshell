
 // contract
export default {
    contract: {
        description: "Preferences page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Preferences"
    },
    template: `
        <x-page x-attr:src="state.src"></x-page>
    `,
    state: {
        src: null
    },
    controller({ state, preferences }) {
        return {
            load() {
                // Show the current page option for debugging purposes
                state.src = preferences.options.page;
            }
        };
    }
};
