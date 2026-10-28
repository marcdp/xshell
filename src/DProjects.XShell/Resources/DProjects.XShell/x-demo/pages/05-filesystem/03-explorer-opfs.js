
export default {
    meta: {
        title: "Persistent File Explorer",
        description: "Explore origin-private browser storage with the filesystem Component."
    },

    template: `
        <p>The <code>opfs:</code> filesystem uses origin-private browser storage. Files persist across Page visits in the same browser and origin.</p>
        <p x-if="!state.available">OPFS requires browser support and a secure context.</p>
        <x-filesystem x-if="state.available" root src="opfs:" path="/"></x-filesystem>
    `,

    state: { available: false },

    controller({state}) {
        return {
            load() {
                state.available = window.isSecureContext &&
                    typeof navigator.storage?.getDirectory === "function";
            }
        };
    }
};
