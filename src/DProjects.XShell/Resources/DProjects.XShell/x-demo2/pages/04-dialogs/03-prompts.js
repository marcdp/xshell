export default {
    meta: {
        title: "Prompts",
        description: "A prompt collects one value and returns it to the caller."
    },

    template: `
        <p>A prompt collects one value and returns it to the caller.</p>
        <x-button label="Ask for a name" command="ask"></x-button>
        <p x-if="state.result">Name: {{ state.result }}</p>
        
    `,

    state: {
        result: ""
    },

    controller({ dialog, state }) {
        return {
            async ask() {
                state.result = await dialog.prompt({ title: "Your name", message: "Enter a name", value: "Ada" });
            }
        };
    }
};
