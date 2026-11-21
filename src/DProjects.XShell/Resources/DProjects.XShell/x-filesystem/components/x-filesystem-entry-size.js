
export default {
    contract: {
        description: "Calculates and displays the total size of a file or directory recursively.",
        tags: ["filesystem", "files", "storage"],
        properties: {
            src: {type:"string", default:"", attribute:true, state:true, description:"Filesystem source."},
            path: {type:"string", default:"/", attribute:true, state:true, description:"File or directory path."}
        },
        methods: {
            refresh: {description:"Recalculates the size."}
        },
        examples: [
            {
                name: "directory",
                description: "Display the size of a directory and all its descendants.",
                template: `<x-filesystem-entry-size src="opfs:" path="/documents"></x-filesystem-entry-size>`
            }
        ]
    },

    template: `
        <x-file-size x-prop:value="state.size"></x-file-size>
    `,

    state: {
        src: "",
        path: "/",
        size: -1
    },

    controller({ state, events, loader }) {
        let abortController = null;

        return {
            load() {
                // Recalculate whenever the source or path changes.
                events.on(state, ["change:src", "change:path"], "refresh");
                this.refresh();
            },

            unload() {
                // Cancel any running calculation.
                abortController?.abort();
            },

            async refresh() {
                // Cancel the previous scan and reset the size.
                abortController?.abort();
                const controller = new AbortController();
                abortController = controller;
                const signal = controller.signal;
                state.size = -1;

                if (!state.src || !state.path) return;

                try {
                    // Resolve the filesystem and inspect the requested entry.
                    const filesystem = await loader.load("filesystem:" + state.src);
                    if (signal.aborted) return;

                    const entry = await filesystem.getEntry(state.path, { signal });
                    if (signal.aborted) return;
                    if (!entry) throw new Error(`Entry not found: ${state.path}`);

                    if (entry.type === "file") {
                        state.size = this.getSize(entry);
                        return;
                    }
                    if (entry.type !== "directory") throw new Error(`Unsupported entry type: ${entry.type}`);

                    // Scan direct children first, then visit subdirectories progressively.
                    let total = 0;
                    const directories = [state.path];
                    state.size = 0;

                    for (let index = 0; index < directories.length; index++) {
                        for await (const child of filesystem.getEntries(directories[index], { mode:"all", signal })) {
                            if (signal.aborted) return;

                            if (child.type === "directory") {
                                directories.push(child.path);
                            } else if (child.type === "file") {
                                total += this.getSize(child);
                                state.size = total;
                            }
                        }
                    }

                } catch (error) {
                    if (!signal.aborted) {
                        state.size = -1;
                        console.error("Filesystem size calculation failed:", error);
                    }
                } finally {
                    if (abortController === controller) abortController = null;
                }
            },

            getSize(entry) {
                // Reject invalid file lengths instead of silently returning a wrong total.
                if (!Number.isSafeInteger(entry.length) || entry.length < 0) {
                    throw new Error(`Invalid file size: ${entry.path}`);
                }
                return entry.length;
            }
        };
    }
};
