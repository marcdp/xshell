
// page
export default {
    contract: {
        description: "Viewer page",
        events: {},
        properties: {
            value: { type: "string", default:"", description: "The html to display", context:true, state:true},
        },
        methods: {}
    },
    meta: {
        title: "Viewer"
    },
    style: `
         
    `,
    template: `
        <div x-html="state.value"></div>        
    `,    
    state: {
        value: ""
    },
    controller({ }) {
        return {
            load(){
                //load
            }
        };
    }
}
