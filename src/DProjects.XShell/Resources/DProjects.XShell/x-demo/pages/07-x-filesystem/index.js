
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
        <x-filesystem></x-filesystem>

        <h3>Components</h3>
        <ul>
            <li><code>x-filesystem</code> — complete explorer.</li>
            <li><code>x-filesystem-tree</code> — folder navigation.</li>
            <li><code>x-filesystem-list</code> — directory contents.</li>
            <li><code>x-filesystem-detail</code> — file preview or editor.</li>
        </ul>
    `
};
