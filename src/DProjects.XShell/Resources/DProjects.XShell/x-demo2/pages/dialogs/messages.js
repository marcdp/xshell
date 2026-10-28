export default {
    template: `
        <h1>Messages</h1>
        <p>A message dialog displays one notice and returns when closed.</p>
        <x-button label="Show information" command="show"></x-button>
        <p x-if="state.result">Result: {{ state.result }}</p>
        
    `,
    state: { result: "" },
    controller({ dialog, state }) {
        return { async show() { state.result = await dialog.message({ type: "info", title: "Information", message: "This is a local example." }); } };
    }
};
