
 // contract
export const contract = {
    description: "Filesystem explorer demo",
    events: {},
    properties: {},
    methods: {}
};

// page
export default {
    meta:{

    },
    style: `
        
    `,
    template: `
        <x-filesystem src="http://localhost:5000/prefix/shares/marc"></x-filesystem>        
    `
};
