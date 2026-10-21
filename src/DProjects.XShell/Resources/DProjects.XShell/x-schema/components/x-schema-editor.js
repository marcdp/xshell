import validateXSchema from "../validation/x-schema.js";

// contract
export const contract = {
    description: "Displays an editor for structured data described by an X-Schema document.",
    events: {},
    properties: {
        src: {type:"string", default:null, attribute:true, state:true, description:"The source URL of the schema."},
        schema: {type:"object", default:null, attribute:false, state:true, description:"The X-Schema document that defines the editor."},
        value: {type:"object", default:null, attribute:false, state:true, description:"The structured data object being edited."}
    },
    methods: {}
};


// implementation
export default {
    style: `
        :host {display:block;}
    `,
    template: `
        This is the x-schema-editor component
    `,
    state: {
        src: null,
        schema: null,
        value:  null
    },
    controller({ events, state, host }) {
        return {
            load() {
                // load
                events.on(state, "change:value", "refresh");
                events.on(state, "change:schema", "refresh");
                events.on(state, "change:src", async () => {
                    const response = await fetch(state.src);
                    state.schema = await response.json();
                });
            },
            mount() {
                //mount
            },
            refresh() {
                // refresh
                if (state.schema && state.value) {
                    // validate schema
                    validateXSchema(state.src, state.schema);
                    // validate value against schema
                    // ...
                    // render the editor based on the schema and value
                    // ...
                }
            }
        }
    }
};

