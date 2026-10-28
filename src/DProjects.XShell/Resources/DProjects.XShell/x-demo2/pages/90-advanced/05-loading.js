export default {
    meta: {
        title: "Resolver and Loader",
        description: "The Resolver identifies a resource and loader; the Loader obtains its value."
    },

    template: `
        <p>The Resolver identifies a resource and loader; the Loader obtains its value.</p>
        <x-button label="Load an icon" command="loadIcon"></x-button>
        <p>Loader: {{ state.loaderName }}</p>
        <p>Loaded value: {{ state.value }}</p>
        
    `,

    state: {
        loaderName: "",
        value: ""
    },

    controller({ resolver, loader, state }) {
        return {
            async loadIcon() {
                const name = "icon:x-file";
                const result = resolver.resolve(name);
                state.loaderName = result.definition.loader;
                const value = await loader.load(name);
                state.value = value?.constructor?.name || typeof value;
            }
        };
    }
};
