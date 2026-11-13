import aes from "../js/aes.js";

export default {
    contract: {
        description: "Filesystem file editor",
        events: {},
        properties: {
            src: {type:"string", default:null, state:true, query:true},
            path: {type:"string", default:null, state:true, query:true}
        },
        methods: {}
    },

    meta: {
        title:"Edit file",
        classes: ["fill"]
    },

    style: `
        x-toolbar {flex:1;}
        x-toolbar span {padding-left:.5em; display:block;}
        x-notice {margin: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);}
        codemirror-editor {border-top: 1px var(--x-datafield-border-color) solid;}
    `,

    template: `
        <x-toolbar slot="header-actions" x-if="!state.error">
            <x-button label="Save" icon="x-save" command="save" class="light"></x-button>
            <span>
                
            </span>
            <span style="flex:1"></span>            
            <x-button tooltip="Preview" icon="x-preview" command="preview" class="round light"></x-button>
            <x-button tooltip="Print" icon="x-print" command="print" class="round light"></x-button>
        </x-toolbar>
        
        <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
        
        <x-code-editor class="editor" x-else x-prop:mode="state.mode" x-model="state.value" x-on:keydown="onKeyDown" x-on:dirty="onDirty" autofocus></x-code-editor>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        mode: null,
        value: null,
        error: null,
        dirty: false,
        aes: false,
        aes_password: null,
    },

    controller({state, page, loader, dialog, commands, markdown}) {
        return {
            async load() {
                // load
                page.label = state.path.split("/").pop();
                page.description = state.path;
                this.refresh();
            },
            async refresh() {
                // refresh
                state.filesystem = await loader.load("filesystem:" + state.src);
                state.entry = await state.filesystem.getEntry(state.path);
                if (state.entry == null) {
                    state.error = "Entry not found: " + state.path;
                    return;
                }
                let extension = state.path.split(".").pop();
                state.mode = "text";
                if (extension === "aes") {
                    state.aes = true;
                    extension = state.path.substr(0, state.path.length - 4).split(".").pop();
                }
                if (extension === "css") state.mode = "css";
                if (extension === "html") state.mode = "html";
                if (extension === "js") state.mode = "javascript";
                if (extension === "json") state.mode = "json";
                if (extension === "md") state.mode = "markdown";
                if (extension === "yaml" || extension === "yml") state.mode = "yaml";
                if (extension === "xml") state.mode = "xml";                
                // load value
                const stream = await state.filesystem.loadReadStream(state.path);
                let value = await new Response(stream).text();
                if (state.aes) {
                    state.aes_password = await dialog.prompt({ title: "Enter password", inputType: "password", required:true});
                    if (!state.aes_password) {
                        state.error = "Password is required.";
                        commands.enqueue("close");
                        return;
                    }
                    try {
                        value = await aes.decrypt(value, state.aes_password);
                    } catch (error) {
                        state.error = error.message || "Unable to decrypt file.";
                        commands.enqueue("close");
                        return;
                    }
                }   
                state.value = value;
            },
            async save() {   
                // save
                let value = state.value ?? "";
                state.saving = true;
                state.saved = false;
                state.error = null;
                try {
                    if (state.aes) {
                        value = await aes.encrypt(value, state.aes_password, {
                            encoding: "Base64",
                            fold: 76
                        });
                    }
                    const blob = new Blob([value], {
                        type: "text/plain;charset=utf-8"
                    });
                    const entry = await state.filesystem.saveFile(state.path, blob);
                    state.entry = entry ?? await state.filesystem.getEntry(state.path);
                    state.saved = state.value === value;
                } catch (error) {
                    state.error = error.message || "Unable to save file.";
                } finally {
                    state.saving = false;
                }
                // set not dirty
                const editor = page.host.querySelector(".editor");
                editor.dirty = false;
            },
            print() {
                // print
                const win = window.open("", "_blank");
                if (!win) return;
                const pre = win.document.createElement("pre");
                pre.textContent = state.value;
                Object.assign(pre.style, {fontFamily: "Consolas, monospace", fontSize: "10px", whiteSpace: "pre-wrap", overflowWrap: "anywhere"});
                win.document.body.appendChild(pre);
                win.document.close();
                win.addEventListener("afterprint", () => {
                    win.close();
                });
                win.focus();
                win.print();
            },
            async preview() {
                //preview
                const html = markdown.parse(state.value);
                await dialog.open({
                    href: "page:x-filesystem:/pages/viewer.js",
                    title: "Preview",
                    context: {
                        value: html
                    }
                });
            },
            close(){
                page.close();
            },

            // events
            onChange({ event }) {
                // on change
                state.value = event.detail.newValue;
            },
            onDirty({ event }) {
                // on dirty
                state.dirty = event.detail.value;
                page.label = state.path.split("/").pop() + (state.dirty ? " *" : "");
            },
            async onKeyDown({ event }) {
                // on key down
                if (event.key === "p" && (event.ctrlKey || event.metaKey)) {
                    // print
                    const editor = page.host.querySelector(".editor");
                    editor.refreshValue();
                    event.preventDefault();
                    this.print();
                } else if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
                    // save
                    const editor = page.host.querySelector(".editor");
                    editor.refreshValue();
                    event.preventDefault();
                    commands.enqueue("save");
                }
            }
        };
    }
};
