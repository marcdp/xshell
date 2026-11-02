
// component
export default {
    contract: {
        description: "Filesystem detail component",
        events: {
            change: {
                description: "Triggered when the value changes",
                detail: {
                    oldValue: {type:"any"},
                    newValue: {type:"any"}
                }
            }
        },
        properties: {
            value: {type:"any", default:null, attribute:true, state:true},
        },
        methods: {},
        slots: {}
    },
    style: `
        :host {display:block; height:100%; flex:1;}
    `,
    template: `
        <codemirror-editor x-model="state.value"></codemirror-editor>
    `,
    state:{
        value:null
    },
    controller({state, events, host}) {
        return {
            async load() {
                // load
                events.on(state, "change:value", (event) => {
                    if (event.oldValue && event.oldValue !== event.newValue) {
                        host.dispatchEvent(new CustomEvent("change", {detail: {oldValue: event.oldValue, newValue: event.newValue}, bubbles: true, composed: true}));
                    }
                })
            }
        };
    }

};

