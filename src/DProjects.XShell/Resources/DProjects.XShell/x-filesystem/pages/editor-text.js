
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
        x-toolbar {border-bottom: var(--x-divider-border);}
    `,

    template: `
        <x-button slot="header-actions" label="Save" icon="x-save" command="save" class="light"></x-button>
        <x-button slot="header-actions" label="Print" icon="x-print" command="print" class="light"></x-button>
        <codemirror-editor x-model="state.value" style=""></codemirror-editor>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        value: null,
        componentName: null
    },

    controller({state, page, loader, resolver, events}) {
        return {
            async load() {
                // load
                this.refresh();
                page.label += ": " + state.path;
            },
            async refresh() {
                // refresh
                state.filesystem = await loader.load("filesystem:" + state.src);
                state.entry = await state.filesystem.getEntry(state.path);
                // load value
                const stream = await state.filesystem.loadReadStream(state.path);
                state.value = await new Response(stream).text();
            },
            onChange({ event }) {
                state.value = event.detail.newValue;
            }
        };
    }
};
