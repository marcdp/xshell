// export page
export default {
    template: `
        <x-datafields>

            <div x-if="state.results.length > 0">
                <x-listview x-if="state.results.length > 0" view="list" title="Search results">
                    <x-listview-item 
                        x-for="result in state.results"
                        x-attr:label="result.label"
                        x-attr:description="result.description"
                        x-attr:icon="result.logo"
                        x-attr:href="result.href"
                        x-attr:target="result.target"
                        x-attr:category="result.category"                    
                    ></x-listview-item>
                </x-listview>       
                <div>
                    <br>
                    <b>{{ state.results.length }}</b> results found for <b>{{state.keyword}}</b>
                </div>
            </div>

            <div x-else>
                <div x-if="state.keyword.length > 2">
                    No search results for <b>{{state.keyword}}</b>
                </div>
                <div x-else>
                    Enter at least 3 characters to search
                </div>
            </div>
            
        </x-datafields>    
    `,    
    state: {
        keyword: {value:"", attr:true},
        results: {value:[]}
    },
    script({ state, events, bus, modules, config }) {
        return {
            onCommand(command, params) {
                if (command == "load") {
                    // load
                    events.on(bus, "xshell:search", (event) => {
                        state.keyword = event.detail.keyword
                    });                
                    events.on(state, "change:keyword", "search");

                } else if (command == "search") {
                    // search
                    let keyword = state.keyword.toLowerCase();
                    let results = [];
                    let category_ant = null;
                    if (keyword.length > 2) {
                        var searchRecursive = function(module, menuitem) {
                            if (menuitem.label.toLowerCase().indexOf(keyword) >= 0 && menuitem.href) {
                                results.push({
                                    label: menuitem.label,
                                    description: menuitem.description,
                                    category: (category_ant != module.label ? module.label : ""),
                                    logo: menuitem.logo || "x-page",
                                    href: menuitem.href,
                                    target: menuitem.target || "#root"
                                });
                                category_ant = module.label
                            }
                            if (menuitem.children) {
                                for (let child of menuitem.children) {
                                    searchRecursive(module, child);
                                }
                            }
                        }
                        for(let module of modules.getModules()) {
                            for(let menu_name of config.getSubKeys("modules." + module.name + ".menus")){
                                let menu = config.get("modules." + module.name + ".menus." + menu_name);
                                searchRecursive(module, menu);
                            }
                        }
                    }
                    state.results = results;
                }                
            }
        };
    }
}
