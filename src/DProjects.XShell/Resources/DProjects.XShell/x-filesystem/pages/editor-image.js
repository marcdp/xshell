
export default {
    contract: {
        description: "Image viewer",
        events: {},
        properties: {
            src: {type:"string", default:null, state:true, query:true},
            path: {type:"string", default:null, state:true, query:true}
        },
        methods: {}
    },

    meta: {
        title:"Image viewer",
        classes: ["fill"]
    },

    style: `        
        img { 
            display:object;
            object-fit: contain;
            max-width:100%;
            max-height:100%;
            
        }
    `,

    template: `
        <x-toolbar slot="top">
            <x-menuitem label="Download" icon="x-download" command="download" class="menuitem"></x-menuitem>
            <x-button label="Refresh" icon="x-refresh" command="refresh" class="menuitem"></x-button>
        </x-toolbar>
        <img x-attr:src="state.url" />
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
            },
            async refresh() {
                // refresh
                state.filesystem = await loader.load("filesystem:" + state.src);
                state.entry = await state.filesystem.getEntry(state.path);
                const response = await state.filesystem.getReadUrl(state.path);
                state.url = response.url;
            }
        };
    }
};
