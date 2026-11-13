import { EditorState,EditorView,basicSetup,javascript,json,html,css,xml,markdown,yaml} from "../vendor/codemirror/6.0.2/codemirror.js";


// component
export default {
    contract: {
        description: "Displays a code mirror editor.",
        events: {        
            change: {
                detail: { 
                    value: {
                        type: "string",
                        description: "The new value of the editor."
                    }
                },
                description: "Fired when the content of the editor changes."
            },
            dirty: {
                detail: {
                    value: {
                        type: "boolean",
                        description: "The new dirty state of the editor."
                    }
                },
                description: "Fired when the dirty state of the editor changes."
            }
        },
        properties: {
            value: {type:"string", default:null, attribute:true, state:true, description:""},
            mode: {type:"string", default:"", attribute:true, state:true, description:"", enum:["javascript", "json", "html", "css"]},
            dirty: {type:"boolean", default:false, state:true, description:"The dirty state of the editor."},
            autofocus: {type:"boolean", default:false, attribute:true, state:true, description:"Whether the editor should autofocus."}
        },
        methods: {
            refreshValue: {
                description: "Refreshes the content of the editor with the current state value.",
                returns: {
                    description: "The refreshed value of the editor.",
                    type: "string"
                }
            } 
        }
    },
    style: `
        :host {display:block; width:100%; height:100%;min-height: 0; }
        :host > div {width:100%; height:100%;}
        .cm-editor {}
        .cm-editor.cm-focused {outline:none;}
        .ͼ1 .cm-content {padding:0;}
        .ͼ2 .cm-gutters {background:var(--x-color-background-xxxx-gray)!important; border-right:none; }
        .ͼ2 .cm-gutters .cm-lineNumbers .cm-gutterElement {padding-left:.75em!important; padding-right:.75em!important;}
        .ͼ2 .cm-activeLineGutter {background:light-dark(#eeeeee, #303030);}
        .ͼ2 .cm-activeLine {background:light-dark(#eeeeee, #303030);}

        .ͼ2 .cm-gutters .cm-gutter.cm-foldGutter {display:none!important;}

        .ͼ1 .cm-scroller {
            scrollbar-width: var(--x-scrollbar-width);
            scrollbar-gutter: var(--x-scrollbar-gutter);
        }
        .cm-editor .cm-cursor { border-left-color: light-dark(#000000, #ffffff); }
    `,
    template: ``,
    meta: {
        renderEngine: "none"
    },
    state: {
        value: null,
        mode: "",
        dirty: false
    },
    controller({ state, host, events }) {
        let editorState = null;
        let editor = null;
        let avoidRefresh = false;
        return {
            load() {
                // load
                events.on(state, "change:value", (event) => {
                    if (event.oldValue != event.newValue && !avoidRefresh){
                        this.refresh();
                    }
                });
                // dirty
                events.on(state, "change:dirty", (event) => {
                    host.dispatchEvent(new CustomEvent("dirty", {
                        detail: { value: state.dirty },
                        bubbles: true
                    }));
                });
            },
            mount() {
                if (state.value) {
                    this.refresh();
                }           
            },
            refresh() {
                // mount
                if (editor) {
                    if (state.value != editor.state.doc.toString()) {
                        editor.dispatch({changes: {from: 0, to: editor.state.doc.length, insert: state.value}});
                    }
                    return;
                }
                let mode = html();
                if (state.mode == "html") mode = html();
                if (state.mode == "javascript") mode = javascript();
                if (state.mode == "json") mode = json();
                if (state.mode == "css") mode = css();
                if (state.mode == "xml") mode = xml();
                if (state.mode == "yaml") mode = yaml();
                if (state.mode == "markdown") mode = markdown();
                editorState = EditorState.create({
                    doc: state.value,
                    extensions: [
                        basicSetup,
                        mode,
                        EditorView.updateListener.of(update => {
                            if (!update.docChanged) return;
                            state.dirty = true;
                        }),
                        ...(state.mode == "markdown" ? [EditorView.lineWrapping] : [])
                    ]
                });
                editor = new EditorView({
                    state: editorState,
                    parent: host.shadowRoot
                });
                editor.dom.addEventListener("blur", () => {
                    const value = editor.state.doc.toString();
                    avoidRefresh = true;
                    state.value = value;
                    host.dispatchEvent(new CustomEvent("change", {
                        detail: { value },
                        bubbles: true
                    }));
                    avoidRefresh = false;
                }, true);
                if (state.autofocus) {
                    editor.focus();
                }
            },
            refreshValue() {
                if (!editor) return;
                avoidRefresh = true;
                state.value = editor.state.doc.toString();
                host.dispatchEvent(new CustomEvent("change", {
                    detail: { value: state.value },
                    bubbles: true
                }));
                avoidRefresh = false;
                return state.value;
            },
        }
    }
};


