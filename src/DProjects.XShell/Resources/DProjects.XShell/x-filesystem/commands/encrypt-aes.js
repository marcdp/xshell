// command
export default {
    // contract 
    contract: {
        label: "Encrypt (AES)",
        description: "Encrypt the selected file using AES.",
        execute: {
            parameters: [
                {name: "src", label:"Filesystem", type: "string", description: "Filesystem source", required:true},
                {name: "path", type: "string", description: "Path to the file to encrypt", required:true},
                {name: "password", type: "string", description: "Password to use for AES encryption", required:true}
            ]
        }        
    },
    // implementation
    controller({ context }) {
        return {
            execute(src, path, password) {
                // debugger
                debugger;
            }
        }
    }
}