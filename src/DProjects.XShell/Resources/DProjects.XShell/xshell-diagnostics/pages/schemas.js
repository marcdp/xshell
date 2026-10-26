
 // contract
export const contract = {
    description: "Schemas page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    meta: {
        title: "Schemas"
    },
    template: `
        <p>Shows discovered JSON schemas, their owning modules, and file sizes.</p>
        <x-listview view="details">
            <x-listview-head>
                <x-listview-column width="17em"><x-datafield type="search" x-model="state.id" placeholder="Schema"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.path" placeholder="Path"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="schema in state.schemas"
                x-attr:href="schema.url"
                x-attr:label="schema.id"
                x-attr:icon="schema.icon"
                target="_blank"
            >
                <div>{{ schema.moduleId }}</div>
                <x-anchor x-attr:href="schema.url" class="plain" target="_blank">
                    {{ schema.path }}
                </x-anchor>
                <x-file-size x-prop:value="schema.size" style="text-align:right"></x-file-size>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        id: "",
        moduleId: "",
        path: "",
        schemas: []
    },
    controller({ state, events, config }) {
        return {
            load() {
                this.refresh();
                events.on(state, "change:id", "refresh");
                events.on(state, "change:moduleId", "refresh");
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
                        if (!file.path.startsWith(schemasPath) || !file.path.endsWith(".json")) continue;
                        const id = file.path.substring(schemasPath.length).replace(/\.schema\.json$/, "");
                        if (state.id && !id.includes(state.id)) continue;
                        if (state.moduleId && !moduleId.includes(state.moduleId)) continue;
                        if (state.path && !file.path.includes(state.path)) continue;
                        schemas.push({
                            id,
                            moduleId,
                            path: file.path,
                            icon: "x-file",
                            url: new URL(file.path.replace(/^\/+/, ""), config.app.baseUrl).href,
                            size: file.size ?? 0
                        });
                    }
                }

                state.schemas = schemas;
            }
        };
    }
};
