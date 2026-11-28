// page
export default {
    contract: {
        description: "App",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "App",
        description: "Shows the effective application configuration derived from the selected root module and host settings."
    },
    template: `
        <x-object x-prop:value="state.config.app" expanded="true"></x-object>
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
