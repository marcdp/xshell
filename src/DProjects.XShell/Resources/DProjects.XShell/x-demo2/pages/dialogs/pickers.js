export default {
    template: `
        <h1>Pickers</h1>
        <p>A picker chooses from a local, deterministic list.</p>
        <x-button label="Choose a color" command="choose"></x-button>
        <p x-if="state.result">Selected: {{ state.result }}</p>
        
    `,
    state: { result: "" },
    controller({ dialog, state }) {
        return { async choose() { state.result = await dialog.picker({ title: "Color", domain: [{ value: "red", label: "Red" }, { value: "blue", label: "Blue" }], inputType: "select" }); } };
    }
};
