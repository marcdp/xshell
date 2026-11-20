// page
export default {
    contract: {
        description: "Components page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Components"
    },
    template: `
        <p>Shows discovered components, their owning modules, load status, size, and load time.</p>
        <x-listview view="details" x-on:activate="inspectContract">
            <x-listview-head>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.id" placeholder="Component ID"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="component in state.components"
                x-prop:value="component.id"
                x-attr:label="component.label"
                x-attr:icon="component.icon"
                target="_blank"
            >
                <div>{{ component.id }}</div>
                <div>{{ component.moduleId }}</div>
                <x-truncate x-attr:text="component.description"></x-truncate>
                <x-file-size style="text-align:right" x-prop:value="component.size"></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="component.time"></x-time-ms></div>
                <div style="text-align:right">{{ component.status }}</div> 
                <x-anchor style="text-align:right" x-attr:href="component.url" target="_blank" class="plain" tooltip="Open source file"
                    x-on:dblclick="keepLinkActivation" x-on:keydown.enter="keepLinkActivation"><x-icon icon="x-open-in-new"></x-icon></x-anchor>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        label: "",
        moduleId: "",
        description: "",
        components: null
    },
    controller({ state, events, config, bus, loader, navigation, page }) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:moduleId", "refresh");
               events.on(state, "change:description", "refresh");
               events.on(state, "change:label", "refresh");
               events.on(bus, "xshell:loader:resource:loaded", (event)=>{
                    if (event.detail.resource.startsWith("component:")) {
                        this.refresh();
                    }
                });
            },
            inspectContract({ event }) {
                // Open the public contract for the activated row.
                const id = event.detail?.value;
                if (typeof id !== "string" || !id.trim()) return;
                return navigation.navigate({
                    href: "page:xshell-diagnostics:/pages/detail/contract-detail.js", 
                    page, 
                    open: "stack",
                    classes: ["size-wide"],
                    params: { kind: "component", id }
                });
            },
            keepLinkActivation({ event }) {
                event.stopPropagation();
            },
            async refresh() {
                // Collect generated component metadata and overlay runtime state without loading resources.
                const list = [];
                const loaderRegistryCache = {};
                for (const loaderRegistryItem of loader.registry) {
                    loaderRegistryCache[loaderRegistryItem.resource] = loaderRegistryItem;
                }
                for (const moduleId of Object.keys(config.modules)) {
                    const moduleConfig = config.modules[moduleId];
                    const moduleComponentsPath = moduleConfig.assets.path + "/components/";
                    for (const file of Object.values(moduleConfig.files)) {
                        if (file.path.startsWith(moduleComponentsPath) && /\.(?:js|html)$/i.test(file.path) && (!file.resource || file.resource.type === "component")) {
                            const id = (file.path.split("/").pop() || "").replace(/\.(?:js|html)$/i, "");
                            const loaderRegistryItem = loaderRegistryCache["component:" + id];
                            const label = file.resource?.label || id;
                            const description = file.resource?.description ?? loaderRegistryItem?.description ?? "";
                            const loaded = (customElements.get(id) != null);
                            const url = new URL(file.path.replace(/^\/+/, ""),config.app.baseUrl).href;
                            let valid = true;
                            if (!this.matches(id, state.id)) valid = false;
                            if (!this.matches(label, state.label)) valid = false;
                            if (!this.matches(moduleId, state.moduleId)) valid = false;
                            if (!this.matches(description, state.description)) valid = false;
                            if (valid) {
                                list.push({
                                    id,
                                    label,
                                    moduleId,
                                    description,
                                    icon: file.resource?.icon || moduleConfig.icon || "x-component",
                                    url,
                                    status: loaded ? "loaded" : loaderRegistryItem?.status || "",
                                    time: loaderRegistryItem?.time || 0,
                                    size: file.size
                                });
                            }
                        }                        
                    }
                };
                list.sort((a, b) => a.id.localeCompare(b.id));
                state.components = list;
            },
            matches(value, query) {
                // Match diagnostic filters consistently regardless of casing.
                return !query || String(value ?? "").toLowerCase().includes(query.toLowerCase());
            }
        };
    }
}
