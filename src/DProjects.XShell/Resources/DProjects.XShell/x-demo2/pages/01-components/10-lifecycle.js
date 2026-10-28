export default {
    meta: {
        title: "Component Lifecycle",
        description: "Mount and remove a Component to observe its supported controller hooks."
    },

    dependencies: { probe: "component:x-demo2-lifecycle" },

    template: `
        <p>A definition-based Component is constructed by its loader. Its controller receives <code>load</code>, <code>mount</code>, <code>unmount</code>, and <code>unload</code> as its host enters and leaves the rendered tree.</p>
        <x-button label="Toggle probe" command="toggle"></x-button>
        <x-demo2-lifecycle x-if="state.visible"></x-demo2-lifecycle>
        <p>Probe visible: {{ state.visible }}</p>
        <ol><li x-for="item in state.events">{{ item }}</li></ol>
        <p>The render engine adds or removes the element; the Component loader owns controller construction and final cleanup.</p>
    `,

    state: { visible: false, events: [] },

    controller({ bus, events, state }) {
        return {
            load() {
                events.on(bus, "x-demo2:component-lifecycle", event => {
                    state.events = [...state.events, event.detail.stage].slice(-12);
                });
            },
            toggle() { state.visible = !state.visible; }
        };
    }
};
