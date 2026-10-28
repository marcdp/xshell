export default {
    meta: { title: "Navigation Actions", description: "Anchors are declarative; Navigation handles controller-driven moves." },
    template: `
        <p>Anchors are declarative; Navigation handles controller-driven moves.</p>
        <p><x-anchor href="../02-pages/04-state.js">Open Page State</x-anchor></p>
        <x-button label="Navigate to Page State" command="openState"></x-button>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/04-state.js"&gt;Open Page State&lt;/x-anchor&gt;</code></pre>
        
    `,
    controller({ navigation, page }) {
        return { openState() { navigation.navigate({ href: "../02-pages/04-state.js", page, open: "auto" }); } };
    }
};
