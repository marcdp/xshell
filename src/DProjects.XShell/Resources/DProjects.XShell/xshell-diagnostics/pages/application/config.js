// page
export default {
    contract: {
        description: "Config",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Config",
        description: "Shows the complete effective XShell configuration used by the running application."
    },
    template: `
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
