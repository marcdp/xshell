
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
        x-notice {margin: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);}
        codemirror-editor {border-top: 1px var(--x-datafield-border-color) solid;}
    `,

    template: `
        <x-toolbar slot="header-actions" x-if="!state.error">
            <x-button label="Save" icon="x-save" command="save" class="light"></x-button>
            <span style="flex:1"></span>
            <span>
                <x-file-size x-prop:value="state.entry.length"></x-file-size>
            </span>
            <x-button label="Print" icon="x-print" command="print" class="light"></x-button>
        </x-toolbar>
        
        <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
        <codemirror-editor x-else x-prop:mode="state.mode" x-model="state.value" x-on:keydown="onKeyDown" x-on:dirty="onDirty" autofocus></codemirror-editor>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        mode: null,
        value: null,
        error: null,
        dirty: false
    },

    controller({state, page, loader}) {
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
                const extension = state.path.split(".").pop();
                state.mode = "text";
                if (extension === "css") state.mode = "css";
                if (extension === "html") state.mode = "html";
                if (extension === "js") state.mode = "javascript";
                if (extension === "json") state.mode = "json";
                if (extension === "md") state.mode = "markdown";
                if (extension === "xml") state.mode = "xml";                
                // load value
                const stream = await state.filesystem.loadReadStream(state.path);
                state.value = await new Response(stream).text();
            },
            async save() {   
                // save
                const value = state.value ?? "";
                state.saving = true;
                state.saved = false;
                state.error = null;
                try {
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
                const editor = page.host.querySelector("codemirror-editor");
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
                    const editor = page.host.querySelector("codemirror-editor");
                    editor.refreshValue();
                    event.preventDefault();
                    this.print();
                } else if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
                    // save
                    const editor = page.host.querySelector("codemirror-editor");
                    editor.refreshValue();
                    state.value = editor.value;
                    event.preventDefault();
                    await this.save();
                }
            }
        };
    }
};
