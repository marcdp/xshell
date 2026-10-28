export default {
    meta: {
        title: "Resolver and Loader",
        description: "Resolve a logical resource, then load and inspect the concrete value."
    },

    template: `
        <p>The Resolver maps a logical resource to a URL and loader selection. The Loader obtains the concrete value.</p>
        <p>Choose a local resource to inspect:</p>
        <x-button label="Icon from x" command="inspectIcon"></x-button>
        <x-button label="Module dataset" command="inspectDataset"></x-button>
        <x-button label="Static dataset" command="inspectStatic"></x-button>
        <p>Logical resource: {{ state.resource }}</p>
        <p>Matched resolver rule: {{ state.rule }}</p>
        <p>Selected loader: {{ state.loaderName }}</p>
        <p>Resolved URL: {{ state.url }}</p>
        <p>Status: {{ state.status }}</p>
        <x-button label="Load selected resource" command="loadSelected"></x-button>
        <p>Concrete result: {{ state.value }}</p>
        <p>Resolution only describes where and how to load. Loading may fetch, parse, or construct the value.</p>
    `,

    state: {
        resource: "", rule: "", loaderName: "", url: "", status: "Choose a resource", value: ""
    },

    controller({ resolver, loader, state }) {
        return {
            load() { this.inspectIcon(); },
            inspectIcon() { this.inspect("icon:x-file"); },
            inspectDataset() { this.inspect("dataset:x-demo2:statuses"); },
            inspectStatic() { this.inspect("dataset:static:A=Active|I=Inactive"); },
            inspect(resource) {
                state.resource = resource;
                state.value = "";
                const result = resolver.resolve(resource);
                state.rule = result?.definition.resource || "No match";
                state.loaderName = result?.definition.loader || "None";
                state.url = result?.url || "None";
                state.status = result ? "Resolved; ready to load" : "Resolution failed";
            },
            async loadSelected() {
                if (!state.resource || !resolver.resolve(state.resource)) return;
                state.status = "Loading";
                try {
                    const value = await loader.load(state.resource);
                    if (state.resource.startsWith("icon:")) {
                        state.value = `${value.nodeName} element`;
                    } else {
                        state.value = `${value.tables[0].rows.length} dataset rows`;
                    }
                    state.status = "Loaded";
                } catch (error) {
                    state.status = `Load failed: ${error.message}`;
                    state.value = "";
                }
            }
        };
    }
};
