export default {
    meta: {
        title: "File Explorer",
        description: "The memory filesystem gives the explorer a local source with no server share."
    },

    template: `
        <p>The memory filesystem gives the explorer a local source with no server share.</p>
        <x-filesystem src="mem:"></x-filesystem>
        <p>The memory source starts empty and exists only for this browser session.</p>
    `
};
