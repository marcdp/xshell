export default {
    contract: {
        description: "Add or edit an filesystems entries.",
        properties: {
            secretName: {type:"string", default:"", state:true, context:true}
        }
    },

    meta: {
        title:"Filesystems",
        icon:"x-filesystem"
    },

    template: `
        <x-notice x-if="state.error" type="error" label="Filesystems editor" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>


    `,

    state: {
        ready: false,
        busy: false,

    },

    controller({state, page, secrets, bus, events, preferences}) {
        return {
            async load() {
                // load

            },

        };
    }
};
