// component
export default {
    contract: {
        description: "Provides a code editor with configurable presentation and editing options.",
        tags: ["code", "editing", "developer-tools"],
        events: {
            change: {
                description: "Raised when the editor value changes.",
                detail: {
                    oldValue: {type:"string"},
                    newValue: {type:"string"}
                }
            }
        },
        properties: {
            value:    {type:"string", default:"", attribute:true, state:true, description:""},
            mode:     {type:"string", default:"", attribute:true, state:true, description:""},
            readonly: {type:"boolean", default:false, attribute:true, state:true, description:""},
            dirty: {type:"boolean", default:false, state:true, description:"The dirty state of the editor."},
            autofocus: {type:"boolean", default:false, attribute:true, state:true, description:"Whether the editor should autofocus."}
        },
        methods: {
            refreshValue: {
                description: "Refreshes the content of the editor with the current state value.",
                returns: {
                    description: "The refreshed value of the editor.",
                    type:"string"
                }
            }
        },
        examples: [
            {
                name: "basic",
                description: "Edit JavaScript and bind the source text to Page state.",
                state: {source: "const title = 'Launch plan';"},
                template: `<x-code-editor mode="javascript" x-model="state.source"></x-code-editor>`
            },
            {
                name: "json-mode",
                description: "Edit JSON using the editor's JSON mode.",
                state: {source: '{"ready": true}'},
                template: `<x-code-editor mode="json" x-model="state.source"></x-code-editor>`
            }
        ]
    },
    style: `
        :host {display:flex; min-height:10em; flex-direction:column; align-items:center; justify-content:center; height:100%;}
        :host x-lazy {width:100%; height:100%;}
        :host codemirror-editor {border-radius:var(--x-datafield-border-radius); flex:1; height:100%; overflow:hidden;;}
        :host x-spinner + x-lazy {visibility:hidden; height:0}
    `,
    state: {
        value: "",
        mode: "",
        readonly: false,
        dirty: false,
        autofocus: false
    },
    template: `
        <!--<x-spinner x-if="!state.ready"></x-spinner>-->
        <codemirror-editor 
            class="editor"
            x-prop:value="state.value"             
            x-prop:readonly="state.readonly" 
            x-prop:autofocus="state.autofocus"
            x-attr:mode="state.mode"
            x-on:change="onChange"
            x-on:dirty="onDirty"
        ></codemirror-editor>
    `,
    controller({ state, events, host }) {
        return {
            load(params) {
                //load
                events.on(state, "change:dirty", (event) => {
                    host.dispatchEvent(new CustomEvent("dirty", {
                        detail: { value: state.dirty },
                        bubbles: true
                    }));
                });
            },
            refreshValue() {
                // refresh the editor with the current state value
                const editor = host.shadowRoot.querySelector(".editor");
                return editor.refreshValue();
            },

            // events
            onChange({event}) {
                //change
                let oldValue = state.value;
                let newValue = event.detail.value ?? "";
                state.value = newValue;
                host.dispatchEvent(new CustomEvent("change", {detail: {oldValue, newValue}, bubbles: true, composed: false}));
            },
            onDirty({event}) {
                state.dirty = event.detail.value ?? false;
            },
        }
    }    
};
