// page
export default {
    contract: {
        description: "Pages",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Pages"
    },
    style: `
        .tags { display: flex; flex-wrap: wrap; gap: .25em; align-items: center; }
    `,
    template: `
        <p>Shows discovered pages, their owning modules, size, load time, and load status.</p>
        <x-listview view="details" x-on:activate="inspectContract">
            <x-listview-head>
                <x-listview-column ><x-datafield type="search" x-model="state.id" placeholder="Page"></x-datafield></x-listview-column>
                <x-listview-column width="17em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column width="20em"><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.tags" placeholder="Tags"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="page in state.pages"
                x-prop:value="page.id"
                x-attr:label="page.id"
                x-attr:icon="page.icon"
                target="_blank"
            >
                <x-truncate x-attr:text="page.label"></x-truncate>
                <x-truncate x-attr:text="page.description"></x-truncate>
                <div>{{ page.moduleId }}</div>
                <div class="tags">
                    <x-chip x-for="tag in page.tags" x-key="tag" x-attr:label="tag"></x-chip>
                </div>
                <x-file-size x-prop:value="page.size" style="text-align:right"></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="page.time"></x-time-ms></div>
                <div style="text-align:right">{{ page.status }}</div>
                <x-anchor style="text-align:right" x-attr:href="page.url" target="_blank" class="plain" tooltip="Open source file"><x-icon icon="x-open-in-new"></x-icon></x-anchor>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        label: "",
        moduleId: "",
        tags: "",
        description: "",
        pages: null
    },
    controller({ state, events, config, bus, loader, navigation, page }) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:moduleId", "refresh");
               events.on(state, "change:tags", "refresh");
               events.on(state, "change:description", "refresh");
               events.on(state, "change:label", "refresh");
               events.on(bus, "xshell:loader:resource:loaded", (event)=>{
                    if (event.detail.resource.startsWith("page:")) {
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
                    params: { kind: "page", id }
                });
            },
            async refresh() {
                // Collect generated page metadata and overlay runtime loader state without loading resources.
                const list = [];
                const loaderRegistryCache = {};
                for (const loaderRegistryItem of loader.registry) {
                    loaderRegistryCache[loaderRegistryItem.resource] = loaderRegistryItem;
                }
                for (const moduleId of Object.keys(config.modules)) {
                    const moduleConfig = config.modules[moduleId];
                    const modulePagesPath = moduleConfig.assets.path + "/pages/";
                    for (const file of Object.values(moduleConfig.files)) {
                        if (file.path.startsWith(modulePagesPath) && /\.(?:js|html|md)$/i.test(file.path) && (!file.resource || file.resource.type === "page")) {
                            const id = file.path;
                            const loaderRegistryItem = loaderRegistryCache["page:" + file.path];
                            const label = file.resource?.title;
                            const description = file.resource?.description ?? loaderRegistryItem?.description ?? "";
                            const tags = file.resource?.tags || [];
                            const url = new URL(file.path.replace(/^\/+/, ""),config.app.baseUrl).href;
                            let valid = true;
                            if (!this.matches(id, state.id)) valid = false;
                            if (!this.matches(label, state.label)) valid = false;
                            if (!this.matches(moduleId, state.moduleId)) valid = false;
                            if (!this.matchesTags(tags, state.tags)) valid = false;
                            if (!this.matches(description, state.description)) valid = false;
                            if (valid) {
                                list.push({
                                    id,
                                    label,
                                    moduleId,
                                    description,
                                    tags,
                                    icon: file.resource?.icon || moduleConfig.icon || "x-page",
                                    url,
                                    status: loaderRegistryItem?.status || "",
                                    time: loaderRegistryItem?.time || 0,
                                    size: file.size
                                });
                            }
                        }                        
                    }
                };
                list.sort((a, b) => a.id.localeCompare(b.id));
                state.pages = list;
            },
            matches(value, query) {
                // Match diagnostic filters consistently regardless of casing.
                return !query || String(value ?? "").toLowerCase().includes(query.toLowerCase());
            },
            matchesTags(tags, query) {
                // Match a partial tag identifier without loading the Page.
                return !query || tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
            }
        };
    }
}
