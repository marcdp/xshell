
 // contract
export default {
    contract: {
        description: "Secrets page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Secrets"
    },
    template: `
        <x-page x-attr:src="state.src"></x-page>
    `,
    state: {
        src: null
    },
    controller({ state, secrets }) {
        return {
            load() {
                // Show the current page option for debugging purposes
                state.src = secrets.options.pageManager;
            }
        };
    }
};
