
// component
export default {
    contract: {
        description: "Displays the translated form of a text value.",
        tags: ["content", "localization"],
        events: {},
        properties: {
            text: {type:"string", default:"", attribute:true, state:true, description:""}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Translate a label using the application's active language.",
                template: `<x-i18n text="Save"></x-i18n>`
            }
        ]
    },
    template: `
        {{ state.localizedText }}
    `,
    state: {
        localizedText: ""
    },
    controller({ state, events, i18n }) {
        const updateLocalizedText = () => {
            state.localizedText = i18n.translate(state.text);
        };
        return {
            load(args) {
                // load
                events.on(state, "change:text", updateLocalizedText);
                updateLocalizedText();
            }
        };
    }
}
