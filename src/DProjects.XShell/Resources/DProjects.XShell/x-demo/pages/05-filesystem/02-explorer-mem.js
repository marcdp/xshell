
export default {
    meta: {
        title: "Memory File Explorer",
        description: "Explore a memory filesystem populated with sample directories and files.",
        classes: ["size-full"]
    },

    template: `
        <p>The <code>mem:</code> filesystem stores directories and files in memory. This example creates a small sample project before displaying the explorer.</p>

        <h2>Sample filesystem</h2>
        <p>The example contains documents, images, source files, and nested directories.</p>

        <x-filesystem root x-prop:src="state.src" x-prop:path="state.path"></x-filesystem>

    `,

    state: {
        src: "mem:demo",
        filesystem: null,
        path: "/"

    },
    controller({ state, loader }) {
        return {
            async mount() {
                // load
                const fs = await loader.load("filesystem:" +state.src);

                await fs.createDirectory("/documents");
                await fs.createDirectory("/documents/reports");
                await fs.createDirectory("/images");
                await fs.createDirectory("/projects/demo/src");

                const files = [
                    ["/readme.txt", "Welcome to the XShell memory filesystem."],
                    ["/documents/notes.txt", "These are sample notes.\nThe filesystem is stored in memory."],
                    ["/documents/reports/summary.txt", "Sample project summary."],
                    ["/projects/demo/src/main.js", 'console.log("Hello from XShell!");'],
                    ["/projects/demo/config.json", JSON.stringify({name:"Demo", version:"1.0.0"}, null, 2)],
                    ["/images/readme.txt", "Place image files in this directory."]
                ];

                for (const [path, content] of files) {
                    if (!await fs.exists(path)) await fs.saveFile(path, content);
                }

                state.filesystem = fs;
            }
        };
    }
};
