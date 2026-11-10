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
        x-notice {margin: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);}
        iframe {width: 100%; height: 100%; border: none;}
    `,

    template: `
        <x-toolbar slot="header-actions" x-if="!state.error">
            <span style="flex:1"></span>
            <span>
                <x-file-size x-prop:value="state.entry.length"></x-file-size>
            </span>
            <x-button label="Print" icon="x-print" command="print" class="light"></x-button>
        </x-toolbar>        
        <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
        <iframe x-attr:src="state.url"></iframe>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        url: null
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
                if (state.entry== null) {
                    state.error = "File not found";
                } else {
                    const definition = await state.filesystem.getReadUrl(state.path);
                    state.url = definition.url;
                }
            },

            print() {
                // print
                const iframe = page.host.querySelector("iframe");
                iframe.contentWindow.print();
            },

            // events
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
