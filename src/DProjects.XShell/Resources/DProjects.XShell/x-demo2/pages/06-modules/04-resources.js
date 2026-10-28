export default {
    meta: { title: "Module Resources", description: "Bootstrap records physical source URLs separately from virtual asset paths." },
    template: `
        <p>Bootstrap records physical source URLs separately from virtual asset paths.</p>
        <p>Descriptor: {{ state.configUrl }}</p>
        <p>Physical assets: {{ state.url }}</p>
        <p>Virtual path: {{ state.path }}</p>
        
    `,
    state: { configUrl: "", url: "", path: "" },
    controller({ config, state }) {
        return { load() { const module = config.modules["x-demo2"]; state.configUrl = module.configUrl; state.url = module.assets.url; state.path = module.assets.path; } };
    }
};
