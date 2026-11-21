
export default {
    meta: {
        title: "Persistent File Explorer",
        description: "Explore origin-private browser storage with the filesystem Component.",
        classes: ["size-full"]
    },

    template: `
        <x-notice type="error" x-if="!state.available">
            OPFS requires browser support and a secure context.
        </x-notice>
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
