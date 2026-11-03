
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
            <x-button label="Print" icon="x-print" command="print" class="light"></x-button>
        </x-toolbar>
        
        <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
        <codemirror-editor x-else x-model="state.value" style=""></codemirror-editor>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        value: null,
        error: null,
        componentName: null
    },

    controller({state, page, loader, resolver, events}) {
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
                // load value
                const stream = await state.filesystem.loadReadStream(state.path);
                state.value = await new Response(stream).text();
            },
            async save() {   
                // save
                // ...
            },

            // events
            onChange({ event }) {
                state.value = event.detail.newValue;
            }
        };
    }
};
