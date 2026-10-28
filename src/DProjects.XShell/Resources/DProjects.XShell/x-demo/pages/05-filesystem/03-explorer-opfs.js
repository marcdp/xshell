
export default {
    meta: {
        title: "File Explorer",
        description: "Explore a memory filesystem populated with sample directories and files."
    },

    template: `
        <p>The <code>mem:</code> filesystem stores directories and files in memory. This example creates a small sample project before displaying the explorer.</p>

        <h2>Sample filesystem</h2>
        <p>The example contains documents, images, source files, and nested directories.</p>

        <x-filesystem src="opfs:" path="/"></x-filesystem>

    `
};
