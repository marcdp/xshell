export default {
    contract: {
        label: "Demo operation",
        description: "Runs a short, cancellable operation for the Commands cookbook Page.",
        tags: ["demo", "operations"],
        execute: {
            parameters: [
                {
                    name: "steps",
                    label: "Steps",
                    type: "integer",
                    required: true,
                    schema: {minimum: 1, maximum: 10}
                },
                {
                    name: "fail",
                    label: "Fail after processing",
                    type: "boolean",
                    default: false
                }
            ],
            returns: {
                type: "object",
                description: "A summary of the completed operation."
            }
        }
    },

    controller({task}) {
        const delay = (milliseconds, signal) => new Promise((resolve, reject) => {
            signal.throwIfAborted();
            const timeout = setTimeout(complete, milliseconds);

            function complete() {
                signal.removeEventListener("abort", cancel);
                resolve();
            }

            function cancel() {
                clearTimeout(timeout);
                reject(signal.reason ?? new DOMException("Command canceled", "AbortError"));
            }

            signal.addEventListener("abort", cancel, {once:true});
        });

        return {
            async execute(steps, fail) {
                task.setDescription("Preparing the demo operation");
                task.setProgress(0, steps);
                task.info(`Received named arguments: steps=${steps}, fail=${fail}`);

                for (let step = 1; step <= steps; step++) {
                    task.signal.throwIfAborted();
                    task.setDescription(`Processing step ${step} of ${steps}`);
                    task.log(`Processing step ${step}`);
                    await delay(300, task.signal);
                    task.setProgress(step, steps);
                }

                if (fail) {
                    task.error("The requested demonstration failure is about to be thrown.");
                    throw new Error("Demo operation failed as requested");
                }

                task.setDescription("Demo operation completed");
                task.info("Returning the Command result");
                return {steps, message:`Processed ${steps} steps`};
            }
        };
    }
};
