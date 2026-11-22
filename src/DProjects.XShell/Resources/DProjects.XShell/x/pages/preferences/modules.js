
export default {
    contract: {
        description: "View configured repository sources and installed modules.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Modules",
        description: "View configured repository sources and installed modules.",
        icon: "x-module"
    },

    template: `
    
        <x-datafields>
            <x-datafield label="Sources" class="no-padding">
                <x-listview x-if="state.sources.length > 0" view="details">
                    <x-listview-head>
                        <x-listview-column label="Repository URL"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item
                            x-for="source in state.sources"
                            x-attr:key="source.id"
                            x-attr:label="source.url">
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-datafield>

            <x-datafield label="Installed modules" class="no-padding">
                <x-listview x-if="state.modules.length > 0" view="details">
                    <x-listview-head>
                        <x-listview-column label="Name" width="12em"></x-listview-column>
                        <x-listview-column label="Version" width="8em"></x-listview-column>
                        <x-listview-column label="Label"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item
                            x-for="module in state.modules"
                            x-attr:key="module.id"
                            x-attr:label="module.id"
                            icon="x-module">
                            <span x-text="module.version"></span>
                            <span x-text="module.label"></span>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-datafield>
        </x-datafields>
    `,

    state: {
        sources: [],
        modules: []
    },

    controller({state, config, modules}) {
        return {
            load() {
                // Load configured repository sources in their precedence order.
                state.sources = (config.app.sources || []).map((url, index) => ({
                    id: index,
                    url
                }));

                // Load installed module metadata and sort by module name.
                state.modules = modules.registry.map(module => ({
                    id: module.id,
                    version: module.version,
                    label: module.label
                })).sort((a, b) => a.id.localeCompare(b.id));
            }
        };
    }
};
