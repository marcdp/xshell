export default {
    template: `
        <h1>Choose a Greeting</h1>
        <p>This Page is opened by the Custom Dialog example.</p>
        <x-button label="Hello" command="choose"></x-button>
        
    `,

    controller({ page }) {
        return {
            choose() {
                page.close("Hello");
            }
        };
    }
};
