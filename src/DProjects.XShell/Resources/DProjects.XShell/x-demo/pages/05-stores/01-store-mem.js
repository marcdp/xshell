export default {
    meta: {
        title: "Memory Store",
        description: "Browse and edit sample customers and products without an external backend."
    },
    template: `
        <p><code>stores.open("mem:demo")</code> exposes sample collections and validates every mutation against each collection's embedded JSON Schema.</p>
        <p><x-button label="Open Store Explorer" x-on:click="openExplorer"></x-button></p>
        <p>Changes remain available while this application is running and are isolated from other memory Store identities.</p>
    `,
    controller({navigation, page}) {
        return {
            openExplorer() {
                // Open the module Page through its logical resource and pass the provider source as a Page parameter.
                return navigation.navigate({href: "page:x-store:/pages/store.js", page, open: "stack", params: {src: "mem:demo"}});
            }
        };
    }
};
