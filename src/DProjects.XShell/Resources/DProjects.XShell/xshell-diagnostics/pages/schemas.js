
 // contract
export default {
    contract: {
        description: "Schemas page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Schemas",
        description: "Shows discovered JSON schemas, their owning modules, and file sizes."
    },
    template: `
        <x-listview view="details">
            <x-listview-head>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.id" placeholder="Schema"></x-datafield></x-listview-column>
                <x-listview-column width="17em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.path" placeholder="Path"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="schema in state.schemas"
                x-attr:label="schema.id"
                x-attr:icon="schema.icon"
                target="_blank"
            >
                <div>{{ schema.label }}</div>
                <x-truncate x-attr:text="schema.description"></x-truncate>
                <div>{{ schema.moduleId }}</div>
                <div>{{ schema.path }}</div>
                <x-file-size x-prop:value="schema.size" style="text-align:right"></x-file-size>
                <x-anchor style="text-align:right" x-attr:href="schema.url" target="_blank" class="plain"><x-icon icon="x-open-in-new" ></x-icon></x-anchor>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        id: "",
        label: "",
        moduleId: "",
        description: "",
        path: "",
        schemas: []
    },
    controller({ state, events, config }) {
        return {
            load() {
                this.refresh();
                events.on(state, "change:id", "refresh");
                events.on(state, "change:label", "refresh");
                events.on(state, "change:moduleId", "refresh");
                events.on(state, "change:description", "refresh");
                events.on(state, "change:path", "refresh");
            },
            refresh() {
                const schemas = [];

                const sources = [
                    ["xshell", config.xshell],
                    ...Object.entries(config.modules)
                ];

                for (const [moduleId, moduleConfig] of sources) {
                    const schemasPath = moduleConfig.assets.path + "/schemas/";

                    for (const file of moduleConfig.files ?? []) {
                        if (!file.path.startsWith(schemasPath) || !file.path.toLowerCase().endsWith(".schema.json") || (file.resource && file.resource.type !== "schema")) continue;
                        const id = file.path.substring(schemasPath.length).replace(/\.schema\.json$/i, "");
                        const label = file.resource?.title || id;
                        const description = file.resource?.description || "";
                        if (!this.matches(id, state.id)) continue;
                        if (!this.matches(label, state.label)) continue;
                        if (!this.matches(moduleId, state.moduleId)) continue;
                        if (!this.matches(description, state.description)) continue;
                        if (!this.matches(file.path, state.path)) continue;
                        schemas.push({
                            id,
                            moduleId,
                            label,
                            description,
                            schemaId: file.resource?.id || "",
                            path: file.path,
                            icon: "x-file",
                            url: new URL(file.path.replace(/^\/+/, ""), config.app.baseUrl).href,
                            size: file.size ?? 0
                        });
                    }
                }
                schemas.sort((a, b) => a.id.localeCompare(b.id));
                state.schemas = schemas;
            },
            matches(value, query) {
                // Match diagnostic filters consistently regardless of casing.
                return !query || String(value ?? "").toLowerCase().includes(query.toLowerCase());
            }
        };
    }
};
