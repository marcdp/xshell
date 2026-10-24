
// contract
export const contract = {
    description: "Filesystem component",
    events: {},
    properties: {
        src: {type: "string", default:"", attribute: true, state:true, description: "Source of the filesystem (e.g., 'mem:')"}
    },
    methods: {},
    slots: {}
};


// implementation
export default {
    style: `
        :host {display:flex; border:1px red solid}
    `,
    template: `
    `,
    state: {
        filesystem: null
    },
    controller({ state, events, host, filesystemFactory }) {
        return {
            async load(args) {
                // load
                events.on(state, "change:src", (event)=>{
                    state.filesystem = filesystemFactory.create(event.detail);
                })
            }
        }
    }   
};

