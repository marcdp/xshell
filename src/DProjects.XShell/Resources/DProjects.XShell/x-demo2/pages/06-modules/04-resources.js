export default {
    meta: {
        title: "Module Resources",
        description: "Compare descriptor, physical assets, virtual path, and a resolved resource."
    },

    template: `
        <p><code>configUrl</code> locates the module definition. <code>assets.url</code> locates its physical content; <code>assets.path</code> is the virtual namespace used by Pages and other resources.</p>
        <p>Definition: {{ state.configUrl }}</p>
        <p>Physical assets: {{ state.assetsUrl }}</p>
        <p>Virtual assets: {{ state.assetsPath }}</p>
        <p><code>dataset:x-demo2:statuses</code> resolves to: {{ state.datasetUrl }}</p>
        <p>The dataset URL uses the virtual path. The configured resource mapping supplies the physical bytes.</p>
        <p><x-anchor href="../90-advanced/05-loading.js">Inspect the Resolver and Loader</x-anchor></p>
    `,

    state: { configUrl: "", assetsUrl: "", assetsPath: "", datasetUrl: "" },

    controller({ config, resolver, state }) {
        return {
            load() {
                const module = config.modules["x-demo2"];
                state.configUrl = module.configUrl;
                state.assetsUrl = module.assets.url;
                state.assetsPath = module.assets.path;
                state.datasetUrl = resolver.resolve("dataset:x-demo2:statuses")?.url || "Not resolved";
            }
        };
    }
};
