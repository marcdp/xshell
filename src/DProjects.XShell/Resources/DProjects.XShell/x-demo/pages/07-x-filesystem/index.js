
 // contract
export const contract = {
    description: "Filesystem explorer demo",
    events: {},
    properties: {},
    methods: {}
};

// page
export default {
    template: `
        <h2>Filesystem</h2>

        <p>
            The <code>x-filesystem</code> module provides a reusable
            filesystem explorer composed of a directory tree,
            file list, and file detail view.
            Filesystem providers can expose different storage
            systems through a common interface.
        </p>

        <h3>Explorer</h3>
        <x-filesystem src="http://localhost:5000/prefix/shares/marc"></x-filesystem>

    `
};
