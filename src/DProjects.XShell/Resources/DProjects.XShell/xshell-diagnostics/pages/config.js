// page
export default {
    contract: {
        description: "Config page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Config Page"
    },
    template: `
        <p>Shows the complete effective XShell configuration used by the running application.</p>
        <x-object x-prop:value="state.config" expanded="true"></x-object>
    `,    
    state:{
        config: null
    },
    controller({ state, config }) {
        return {
            load() {
               // load
               state.config = config;
            }
        };
    }
}
