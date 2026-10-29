
export default {
    meta: {
        title: "Local File Explorer",
        description: "Explore files and directories on the local computer."
    },

    template: `
        <p>Select a local directory to browse and manage its contents.</p>

        <p x-if="!state.available">Local filesystem access requires a supported browser and a secure context.</p>

        <x-button x-if="state.available" label="Select Folder..." icon="x-folder" x-on:click="selectFolder"></x-button>

        <x-filesystem x-if="state.filesystem" root x-prop:filesystem="state.filesystem" path="/"></x-filesystem>
    `,

    state: {
        available: false,
        filesystem: null
    },

    controller({state, loader}) {
        return {
            load() {
                // load availability of local filesystem access
                state.available = window.isSecureContext && typeof window.showDirectoryPicker === "function";
            },

            async selectFolder() {
                try {
                    const fs = await loader.load("filesystem:file:");
                    await fs.selectDirectory();
                    state.filesystem = fs;
                } catch (error) {
                    if (error.name !== "AbortError") console.error("Unable to select local folder:", error);
                }
            }
        };
    }
};
