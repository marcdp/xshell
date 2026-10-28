export default {
    template: `
        <h1>Navigation Actions</h1>
        <p>Anchors are declarative; Navigation handles controller-driven moves.</p>
        <p><x-anchor href="../pages/state.js">Open Page State</x-anchor></p>
        <x-button label="Navigate to Page State" command="openState"></x-button>
        <pre x-pre><code>&lt;x-anchor href="../pages/state.js"&gt;Open Page State&lt;/x-anchor&gt;</code></pre>
        
    `,
    controller({ navigation, page }) {
        return { openState() { navigation.navigate({ href: "../pages/state.js", page, open: "auto" }); } };
    }
};
