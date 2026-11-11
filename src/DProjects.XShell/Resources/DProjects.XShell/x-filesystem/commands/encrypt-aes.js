// command
export default {
    // contract 
    contract: {
        label: "Encrypt (AES)",
        description: "Encrypt the selected file using AES.",
        execute: {
            description: "Encrypt the selected file using AES.",
            parameters: [
                {name: "password", type: "string", description: "Password to use for AES encryption.", required:true}
            ]
        }        
    },
    // implementation
    controller({ context }) {
        return {
            execute(password) {
                // debugger
                debugger;
            }
        }
    }
}