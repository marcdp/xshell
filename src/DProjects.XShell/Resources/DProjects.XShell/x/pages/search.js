// page
export default {
    contract: {
        description: "Shows a search page.",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Page search",
        description: "Enter at least 3 characters to search",
        classes: ["stack-size-narrow"]
    },
    template: `
        <x-datafields>
            <x-datafield type="search" placeholder="Search" x-model="state.keyword" autocomplete="off" autofocus></x-datafield>

            <div x-if="state.results.length > 0">
                <x-listview x-if="state.results.length > 0" view="tiles" title="Search results" x-on:activate="activate">
                    <x-listview-head></x-listview-head>
                    <x-listview-body>
                        <x-listview-item
                            x-for="result in state.results"
                            x-attr:label="result.label"
                            x-attr:description="result.description || result.path"
                            x-attr:icon="result.icon"
                            x-attr:href="result.path || result.href"
                            x-attr:target="result.target"
                            x-attr:category="result.category"
                            x-attr:tooltip="result.tooltip || result.description"
                            open="top"
                        ></x-listview-item>
                    </x-listview-body>
                </x-listview>
                <div>
                    <br>
                    <b>{{ state.results.length }}</b> results found for <b>{{state.keyword}}</b>
                </div>
            </div>

            <div x-else>
                <div x-if="state.keyword.length > 2">
                    <x-empty icon="x-search" label="No results" message="No matching pages were found."></x-empty>
                </div>
            </div>
            
        </x-datafields>    
    `,    
    state: {
        keyword: "",
        results: []
    },
    controller({ state, events, areas, config }) {
        return {
            load() {
                // load
                events.on(state, "change:keyword", "search");
            },

            search() {
                // Search labels and generated descriptions while retaining the effective menu item as the result target.
                const keyword = state.keyword.toLowerCase();
                const results = [];
                const seen = new Set();
                if (keyword.length > 2) {
                    const searchRecursive = function(menuitem, category) {
                        const label = String(menuitem.label || "").toLowerCase();
                        const description = String(menuitem.description || "").toLowerCase();
                        if ((label.includes(keyword) || description.includes(keyword)) && menuitem.href && !seen.has(menuitem.href)) {
                            seen.add(menuitem.href);
                            results.push({ 
                                ...menuitem, 
                                icon: menuitem.icon || config.modules[menuitem.module]?.icon,
                                category: category });
                        }
                        if (menuitem.children) {
                            for (let child of menuitem.children) {
                                searchRecursive(child, category);
                            }
                        }
                    }
                    // search current area
                    const currentArea = areas.getCurrentArea();
                    const menu = areas.getMenu("navigation", currentArea.id);
                    for(let menuitem of menu?.items || []) {
                        searchRecursive(menuitem, currentArea.id);
                    }
                    // search other areas
                    for(const area of areas.getAreas()) {
                        if (area.id === currentArea.id) continue;
                        const menu = areas.getMenu("navigation", area.id);
                        for(let menuitem of menu?.items || []) {
                            searchRecursive(menuitem, area.id);
                        }
                    }
                }
                state.results = results;
            },

            activate({event}) {
                const item = event.detail.item;
                if (item && item.href) {
                    window.location.href = item.href;
                }
            }

        };
    }
}
