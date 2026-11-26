// page
export default {
    contract: {
        description: "Explorer page",
        events: {},
        properties: {
            src: {type: "string", default:null, state:true, query:true, description: "Filesystem reference, such as 'named:documents' or 'mem:'"},
            path: {type: "string", default:null, state:true, query:true, description: "Path within the filesystem"}
        },
        methods: {}
    },
    meta: {
        title: "Explorer Page",
        classes: ["size-full"]
    },
    style: `
    `,
    template: `
        <x-filesystem x-prop:src="state.src" x-prop:path="state.path">
        </x-filesystem>
    `,    
    state: {
        src: null,
        path: null
    },
    controller({state}) {
        return {
            load() {
                // load
            }
        }
    }

}
