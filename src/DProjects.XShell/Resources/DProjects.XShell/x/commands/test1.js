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
            ]
        }
    },

    controller({ context }) {
        debugger;
        return {
            async execute(value) {

                debugger;
                context.setDescription("starting execution");

                for (let i = 0; i < value; i++) {
                    context.setProgress(i, value);
                    context.out(`Executing step ${i} of ${value}`);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                return 123;
            }
        };
    }
};
