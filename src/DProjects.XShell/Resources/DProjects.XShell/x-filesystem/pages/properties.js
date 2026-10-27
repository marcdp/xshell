// contract
export const contract = {
    description: "Properties page",
    events: {},
    properties: {
        src: {type: "string", default:null, state:true, query:true, description: "Source of the filesystem (e.g., 'mem:')"},
        path: {type: "string", default:null, state:true, query:true, description: "Path within the filesystem"}
    },
    methods: {}
};

// export page
export default {
    meta: {
        title: "Properties Page"
    },
    style: `
        iframe {
            display:block;
            width: 100%;
            height: 100%;
            border: none;
        }
    `,
    template: `
        
    `,    
    state: {
        src: null,
        path: null,
        filesystem: null,
        url: null,
        entry: null
    },
    controller({ events, state, loader }) {
        return {
            async load(params) {
               // load
               this.refresh();
            },
            async refresh() {
                // handle refresh event
                if (state.src && state.path) {
                    state.filesystem = await loader.load("filesystem:" + state.src);
                    state.entry = await state.filesystem.getEntry(state.path);
                    state.url = (await state.filesystem.getReadUrl(state.path)).url;
                }
            }
        };
    }
}
