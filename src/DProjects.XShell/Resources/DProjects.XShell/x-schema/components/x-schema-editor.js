
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
    controller({ events, loader, state, xSchemaValidator }) {
        return {
            load() {
                // load
                events.on(state, "change:value", "refresh");
                events.on(state, "change:schema", "refresh");
                events.on(state, "change:src", async () => {
                    state.schema = await loader.load(state.src);
                });
            },
            mount() {
                //mount
            },
            async refresh() {
                // refresh
                if (state.schema && state.value) {
                    // validate schema
                    //validateXSchema(state.src, state.schema);
                    debugger
                    const result = await xSchemaValidator.validate(state.schema);
                    debugger;
                    // validate value against schema
                    // ...
                    // render the editor based on the schema and value
                    // ...
                }
            }
        }
    }
};

