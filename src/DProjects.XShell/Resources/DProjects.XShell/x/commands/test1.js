export default {
    contract: {
        label: "Test 1",
        description: "Test command that accepts a number between 1 and 10.",
        execute: {
            description: "Returns the supplied number.",
            parameters: [
                {name: "value", label: "Value", description: "A number between 1 and 10.", type: "number", required: true, default: 5,
                    schema: {
                        minimum: 1,
                        maximum: 10
                    }
                }
            ],
            returns: {
                type: "string",
                format: "blob-url",
                description: "Browser Blob URL containing the generated file."
            }
        }
    },

    controller({ task }) {
        return {
            async execute(value) {
                task.setDescription("Starting execution");
                task.setProgress(0, value);

                for (let i = 1; i <= value; i++) {
                    task.signal.throwIfAborted();
                    task.setDescription(`Executing step ${i} of ${value}`);
                    task.out(`Executing step ${i} of ${value}`);

                    await new Promise(resolve => setTimeout(resolve, 250));
                    task.setProgress(i, value);
                }

                task.setDescription("Completed");

                const blob = new Blob(["hello"], { type: "text/plain" });
                return URL.createObjectURL(blob);
            }
        };
    }
};
