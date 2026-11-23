
import aes from "../js/aes.js";

// command
export default {
    contract: {
        label: "Encrypt (AES)",
        description: "Encrypts a file using AES and saves the result as a new .aes file.",
        tags: ["filesystem", "files", "encryption"],
        execute: {
            parameters: [
                {name:"src", label:"Filesystem", type:"string", description:"Filesystem source.", required:true},
                {name:"path", label:"Path", type:"string", description:"Path of the file to encrypt.", required:true},
                {name:"password", label:"Password", type:"string", description:"Password used for AES encryption.", required:true}
            ],
            returns: {
                type:"string",
                description:"Path of the encrypted file."
            }
        }
    },

    controller({task, filesystems}) {
        return {
            async execute(src, path, password) {
                // Validate arguments.
                if (!src) throw new Error("Filesystem source is required.");
                if (!path) throw new Error("File path is required.");
                if (!password) throw new Error("Encryption password is required.");

                // Load the filesystem and validate the source file.
                task.setDescription("Loading filesystem...");
                task.setProgress(null);

                const filesystem = await filesystems.open(src);
                task.signal.throwIfAborted();

                const entry = await filesystem.getEntry(path, {signal:task.signal});
                if (!entry) throw new Error(`File not found: ${path}`);
                if (entry.type !== "file") throw new Error(`Path is not a file: ${path}`);

                // Do not overwrite an existing encrypted file.
                const destination = path + ".aes";
                if (await filesystem.getEntry(destination, {signal:task.signal})) {
                    throw new Error(`Destination already exists: ${destination}`);
                }

                // Read the original file content as bytes.
                task.setDescription("Reading file...");
                const stream = await filesystem.loadReadStream(path, {signal:task.signal});
                const content = await new Response(stream).arrayBuffer();
                task.signal.throwIfAborted();

                task.info(`Read ${content.byteLength} bytes from ${path}`);

                // Encrypt the content using the existing AES implementation.
                task.setDescription("Encrypting file...");
                const encrypted = await aes.encrypt(content, password, {
                    encoding: "Base64",
                    fold: 76
                });
                task.signal.throwIfAborted();

                // Save the encrypted bytes to a new file.
                task.setDescription("Saving encrypted file...");
                const blob = new Blob([encrypted], {type:"text/plain;charset=utf-8"});

                await filesystem.saveFile(destination, blob, {signal:task.signal});
                task.signal.throwIfAborted();

                task.info(`Encrypted file saved: ${destination}`);
                task.setDescription("Encryption completed");

                return destination;
            }
        };
    }
};
