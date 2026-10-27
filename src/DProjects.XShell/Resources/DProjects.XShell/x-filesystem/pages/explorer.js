// contract
export const contract = {
    description: "Explorer page",
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
        title: "Explorer Page"
    },
    style: `
    `,
    template: `
        <x-filesystem
            x-prop:src="state.src"
            x-prop:path="state.path"
        >
        </x-filesystem>
    `,    
    state: {
        src: null,
        path: null
    }
}
