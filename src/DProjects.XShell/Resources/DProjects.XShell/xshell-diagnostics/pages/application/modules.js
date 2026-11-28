// page
export default {
    contract: {
        description: "Modules page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Modules",
        description: "Shows the XShell framework and loaded application modules, with asset locations, build metadata, resource counts, and status."
    },
    style: `
        .tags { display: flex; flex-wrap: wrap; gap: .25em; align-items: center; }
    `,
    template: `
        <x-listview view="details">
            <x-listview-head>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.id" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column ><x-datafield type="search" x-model="state.tags" placeholder="Tags"></x-datafield></x-listview-column>
                <x-listview-column label="Version" width="5em"></x-listview-column>
                <x-listview-column label="Assets path"></x-listview-column>
                <x-listview-column label="Size" width="6em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Files" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item
                x-for="module in state.modules"
                x-attr:label="module.id"
                x-attr:icon="module.icon"
                target="_blank"
            >
                <div>{{ module.label }}</div>
                <div>{{ module.description }}</div>
                <div class="tags">
                    <x-chip x-for="tag in module.tags" x-attr:label="tag"></x-chip>
                </div>
                <div>{{ module.version }}</div>
                <div>
                    {{ module.assets.path }}
                </div>
                <x-file-size x-prop:value="module.size" style="text-align:right"></x-file-size>
                <div style="text-align:right">{{ module.files.all }}</div>
                
                <div style="text-align:right">{{ module.status }}</div>
                <x-anchor style="text-align:right" x-attr:href="module.configUrl" target="_blank" class="plain"><x-icon icon="x-open-in-new" ></x-icon></x-anchor>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        version: "",
        label: "",
        description: "",
        tags: "",
        assetPath: "",
        configUrl: "",
        configUrlName: "",
        size: "",
        files: 0,
        modules: null
    },
    controller({ state, events, modules, config }) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:version", "refresh");
               events.on(state, "change:label", "refresh");
               events.on(state, "change:description", "refresh");
               events.on(state, "change:tags", "refresh");
               events.on(state, "change:assetPath", "refresh");
               events.on(state, "change:configUrl", "refresh");
            },
            refresh() {
                // Include the framework configuration in the same inventory as the module registry snapshots.
                const framework = { ...config.xshell, id: "xshell", label: config.xshell.label || "XShell" };
                let list = [];
                for (const target of [framework, ...modules.registry]) {
                    let valid = true;
                    if (state.id && target.id.indexOf(state.id) == -1 ) valid = false;
                    if (state.version && target.version.indexOf(state.version) == -1 ) valid = false;
                    if (state.label && (target.label || "").indexOf(state.label) == -1 ) valid = false;
                    if (state.description && (target.description || "").indexOf(state.description) == -1 ) valid = false;
                    if (!this.matchesTags(target.tags, state.tags)) valid = false;
                    if (state.assetPath && target.assets.path.indexOf(state.assetPath) == -1 ) valid = false;
                    if (state.configUrl && target.configUrl.indexOf(state.configUrl) == -1 ) valid = false;
                    let size = 0;
                    let files = {
                        all: 0,
                        pages: 0,
                        components: 0,
                        services: 0,
                        contracts: 0,
                        others: 0
                    }
                    for(const file of target.files) {
                        size += file.size || 0;
                        files.all++;
                        if (file.path.startsWith(target.assets.path + "/pages")) {
                            files.pages++;
                        } else if (file.path.startsWith(target.assets.path + "/components")) {
                            files.components++;
                        } else if (file.path.startsWith(target.assets.path + "/services")) {
                            files.services++;
                        } else if (file.path.startsWith(target.assets.path + "/contracts")) {
                            files.contracts++;
                        } else {
                            files.others++;
                        }
                    }
                    if (valid) {
                        list.push({
                            id: target.id,
                            version: target.version,
                            label: target.label || "",
                            description: target.description || "",
                            tags: target.tags || [],
                            icon: target.icon || "x-module",
                            assets: {
                                path: target.assets.path,
                                url: target.assets.url || ""
                            },
                            builtAt: target.builtAt || "",
                            configUrl: target.configUrl,
                            configUrlName: target.configUrl.split("/").pop() || "",
                            files: files,
                            size: size,
                            status: "loaded"
                        });
                    }
                };
                list.sort((a, b) => a.id.localeCompare(b.id));
                state.modules = list;
            },
            matchesTags(tags, query) {
                // Match a partial authored tag without inspecting contained resources.
                return !query || (tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()));
            }
        };
    }
}
