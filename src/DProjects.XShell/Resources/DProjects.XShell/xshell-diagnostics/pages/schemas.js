
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
            <x-datafield slot="column" style="width:17em" type="search" x-model="state.id" placeholder="Schema" ></x-datafield>
            <x-datafield slot="column" style="width:10em" type="search" x-model="state.moduleId" placeholder="Module"></x-datafield>
            <x-datafield slot="column" type="search" x-model="state.path" placeholder="Path"></x-datafield>
            <div slot="column" style="width:5em; text-align:right">Size</div>
            <x-listview-item x-for="schema in state.schemas"
                x-attr:href="schema.url"
                x-attr:label="schema.id"
                x-attr:icon="schema.icon"
                target="_blank"
            >
                <div>{{ schema.moduleId }}</div>
                <x-truncate x-prop:text="schema.path"></x-truncate>
                <x-file-size x-prop:value="schema.size" style="text-align:right"></x-file-size>
            </x-listview-item>
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

                        const id = file.path.substring(schemasPath.length);

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
