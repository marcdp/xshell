
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
        <x-notice type="error" x-if="!state.validationResult.valid">
            Error in schema: 
            <ul>
                <li x-for="error in state.validationResult.errors">
                    <b>{{error.instanceLocation}}:</b> {{error.error}} (keyword: {{error.keyword}})                    
                </li>
            </ul>
        </x-notice>
        <div x-else>
            ...
        </div>
    `,
    state: {
        src: null,
        schema: null,
        value:  null,
        validationResult: null
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
                    state.validationResult = await xSchemaValidator.validate(state.schema);;
                    debugger
                    // render
                    if (state.validationResult.valid) {
                        // render the editor based on the schema and value
                        // ...

                    }
                }
            }
        }
    }
};

