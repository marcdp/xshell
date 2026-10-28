export default {
    template: `
        <h1>Custom Dialog</h1>
        <p>The dialog service can open a Page from this module.</p>
        <x-button label="Open custom dialog" command="open"></x-button>
        <p x-if="state.result">Result: {{ state.result }}</p>
        
    `,
    state: { result: "" },
    controller({ dialog, state, page }) {
        return { async open() { const directory = page.src.substring(0, page.src.lastIndexOf("/") + 1); state.result = await dialog.open({ href: directory + "custom-dialog.js", title: "Greeting" }); } };
    }
};
