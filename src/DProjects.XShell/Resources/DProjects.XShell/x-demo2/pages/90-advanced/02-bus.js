export default {
    meta: {
        title: "Event Bus",
        description: "The bus delivers named events; listeners are removed when this Page unloads."
    },

    template: `
        <p>The bus delivers named events; listeners are removed when this Page unloads.</p>
        <x-button label="Publish event" command="publish"></x-button>
        <p>Received: {{ state.count }}</p>
        
    `,

    state: {
        count: 0
    },

    controller({ bus, state }) {
        const eventName = "x-demo2:example";
        const receive = () => {
            state.count += 1;
        };

        return {
            load() {
                bus.addEventListener(eventName, receive);
            },

            publish() {
                bus.emit(eventName, {});
            },

            unload() {
                bus.removeEventListener(eventName, receive);
            }
        };
    }
};
