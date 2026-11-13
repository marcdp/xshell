import { createZip } from "../utils/zip.js";

// command
export default {
    // contract
    contract: {
        label: "Create directory ZIP",
        description: "Creates a ZIP archive containing a filesystem directory.",
        execute: {
            parameters: [
                {name:"src", label:"Filesystem", type:"string", description:"Filesystem source.", required:true},
                {name:"path", label:"Path", type:"string", description:"Path of the directory to archive.", required:true}
            ],
            returns: {
                type: "string",
                format: "blob-url",
                description: "Browser Blob URL containing the generated ZIP archive."
            }
        }
    },

    // implementation
    controller({ task, loader }) {
        return {
            async execute(src, path) {
                // Validate arguments.
                if (!src) throw new Error("Filesystem source is required.");
                if (!path) throw new Error("Directory path is required.");

                // Load the filesystem.
                task.setDescription("Loading filesystem...");
                task.setProgress(null);
                const filesystem = await loader.load("filesystem:" + src);
                task.signal.throwIfAborted();

                // Validate the source directory.
                task.setDescription("Reading directory...");
                const entry = await filesystem.getEntry(path, {signal:task.signal});
                if (!entry) throw new Error(`Directory not found: ${path}`);
                if (entry.type !== "directory") throw new Error(`Path is not a directory: ${path}`);

                // Create the ZIP archive.
                task.setDescription("Creating ZIP archive...");
                task.log(`Creating ZIP archive from ${path}`);
                const blob = await createZip(filesystem, [path], {signal:task.signal});
                task.signal.throwIfAborted();

                // Create the browser URL returned by the Command.
                const url = URL.createObjectURL(blob);
                task.setDescription("ZIP archive created");
                task.log(`ZIP archive created (${blob.size} bytes)`);

                return url;
            }
        };
    }
};
