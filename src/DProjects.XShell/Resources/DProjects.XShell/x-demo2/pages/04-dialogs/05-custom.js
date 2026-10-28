export default {
    meta: {
        title: "Custom Dialog",
        description: "The dialog service can open a Page from this module."
    },

    template: `
        <p>The dialog service can open a Page from this module.</p>
        <x-button label="Open custom dialog" command="open"></x-button>
        <p x-if="state.result">Result: {{ state.result }}</p>
        
    `,

    state: {
        result: ""
    },

    controller({ dialog, state }) {
        return {
            async open() {
                state.result = await dialog.open({ href: "page:x-demo2:/dialog-pages/custom-dialog.js", title: "Greeting" });
            }
        };
    }
};
