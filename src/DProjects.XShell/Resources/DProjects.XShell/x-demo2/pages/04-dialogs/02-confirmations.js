export default {
    meta: {
        title: "Confirmations",
        description: "A confirmation returns the button chosen by the user."
    },

    template: `
        <p>A confirmation returns the button chosen by the user.</p>
        <x-button label="Ask to continue" command="ask"></x-button>
        <p x-if="state.result">Choice: {{ state.result }}</p>
        
    `,

    state: {
        result: ""
    },

    controller({ dialog, state }) {
        return {
            async ask() {
                state.result = await dialog.confirm({ title: "Continue?", message: "Choose Yes or No.", variant: "yesno" });
            }
        };
    }
};
