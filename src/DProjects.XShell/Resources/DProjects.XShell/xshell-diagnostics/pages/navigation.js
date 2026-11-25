// page
export default {
    contract: {
        description: "Navigation",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Navigation",
        description: "Shows the Areas, menus, routes, and page hierarchy used by XShell navigation."
    },
    style: `
        .route-test {margin-bottom:1.5em;}
        .route-test x-toolbar {margin-bottom:.5em;}
        .route-test x-datafield {width:40em; max-width:70vw;}
        .route-value {min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    `,
    template: `
        <x-tabs>
            <x-tab label="Areas">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Area" width="15em"></x-listview-column>
                        <x-listview-column label="Prefix"></x-listview-column>
                        <x-listview-column label="Label"></x-listview-column>
                        <x-listview-column label="Default"></x-listview-column>
                        <x-listview-column label="Home"></x-listview-column>
                        <x-listview-column label="Modules"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                    <x-listview-item x-for="area in state.areas"
                        
                        x-attr:label="area.id"
                        x-attr:icon="area.icon || 'x-area'"
                        target="_blank"
                    >
                        <div>{{ area.prefix }}</div>
                        <div>{{ area.label }}</div>
                        <div><input type="checkbox" x-model="area.default" disabled></div>
                        <div>                           
                            <x-anchor class="plain" x-attr:href="area.home" target="_blank">
                                <x-icon icon="x-open-in-new"></x-icon>
                                {{ area.home }}
                            </x-anchor>
                        </div>
                        <div>{{ area.modules | json_stringify }}</div>

                    </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-tab>
            <x-tab label="Menus">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Menu" width="15em"></x-listview-column>
                        <x-listview-column label="Label"></x-listview-column>
                        <x-listview-column label="Description"></x-listview-column>
                        <x-listview-column label="Items"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="menu in state.menus" x-attr:label="menu.id" x-attr:icon="menu.icon">
                            <div>{{ menu.label }}</div>
                            <div>{{ menu.description }}</div>
                            <x-object x-prop:value="menu.items"></x-object>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-tab>
            
            <x-tab label="Live pages">
                <x-treeview>
                    <x-treeview-head>
                        <x-treeview-column label="Page"></x-treeview-column>
                        <x-treeview-column label="Path"></x-treeview-column>
                        <x-treeview-column label="Layout" width="8%"></x-treeview-column>
                        <x-treeview-column label="Module" width="8%"></x-treeview-column>
                        <x-treeview-column label="Loading" width="8%"></x-treeview-column>
                        <x-treeview-column label="Time" width="5em"></x-treeview-column>
                        <x-treeview-column label="Size" width="5em"></x-treeview-column>
                        <x-treeview-column label="Status" width="5em"></x-treeview-column>
                    </x-treeview-head>
                    <x-treeview-body>
                        <x-treeview-item x-recursive="item in state.children" x-attr:label="item.label" expanded x-class:error="item.status=='error'">
                            <div slot="column" x-attr:title="item.src">{{item.src}}</div>
                            <div slot="column">{{item.layout}}</div>
                            <div slot="column">{{item.module}}</div>
                            <div slot="column">{{item.loading}}</div>
                            <div slot="column"><x-time-ms x-prop:value="item.time"></x-time-ms></div>
                            <div slot="column"><x-file-size x-prop:value="item.size"></x-file-size></div>
                            <div slot="column">{{item.status}}</div>
                        </x-treeview-item>
                    </x-treeview-body>
                </x-treeview>   
            </x-tab>
            <x-tab label="Routes">
                <div class="route-test">
                    <p>Test configured routes without opening a Page. Exact menu aliases take precedence when navigating.</p>
                    <x-toolbar>
                        <x-datafield type="text" x-model="state.test_route" placeholder="Public path, e.g. /cookbook/hello/Alex"></x-datafield>
                        <x-button label="Resolve" command="resolveRoute"></x-button>
                    </x-toolbar>
                    <x-object x-if="state.test_result" x-prop:value="state.test_result" expanded="true"></x-object>
                    <x-notice type="info" x-if="state.test_info">{{ state.test_info }}</x-notice>
                    <x-notice type="error" x-if="state.test_error">{{ state.test_error }}</x-notice>
                </div>
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Area" width="minmax(0, 1fr)">
                            <x-datafield type="search" x-model="state.query_area" placeholder="Area"></x-datafield>
                        </x-listview-column>
                        <x-listview-column label="Route path" width="minmax(0, 2fr)">
                            <x-datafield type="search" x-model="state.query_path" placeholder="Route path"></x-datafield>
                        </x-listview-column>
                        <x-listview-column label="Destination" width="minmax(0, 3fr)">
                            <x-datafield type="search" x-model="state.query_destination" placeholder="Destination"></x-datafield>
                        </x-listview-column>
                        <x-listview-column label="Module">
                            <x-datafield type="search" x-model="state.query_module" placeholder="Module"></x-datafield>
                        </x-listview-column>
                        <x-listview-column label="Parameters"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="route in state.routes" x-attr:label="route.areaId">
                            <div class="route-value" x-attr:title="route.path">{{ route.path }}</div>
                            <div class="route-value" x-attr:title="route.href">{{ route.href }}</div>
                            <div class="route-value" x-attr:title="route.module">{{ route.module }}</div>
                            <div class="route-value" x-attr:title="route.parameters">{{ route.parameters }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-tab>
        </x-tabs>
    `,    
    state:{
        areas: null,
        children: [],
        menus: null,
        routes: [],
        test_route: "",
        test_result: null,
        test_info: "",
        test_error: "",
        query_area: "",
        query_path: "",
        query_destination: "",
        query_module: ""
    },
    controller({ state, events, bus, areas, navigation }) {
        return {
            load() {
                // load
                events.on(state, "change:id", "refresh");
                events.on(state, "change:moduleId", "refresh");
                events.on(state, "change:description", "refresh");
                events.on(state, "change:label", "refresh");
                events.on(state, "change:query_area", "refresh");
                events.on(state, "change:query_path", "refresh");
                events.on(state, "change:query_destination", "refresh");
                events.on(state, "change:query_module", "refresh");
                events.on(bus, "xshell:page:load", "refresh");
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:loader:resource:loaded", (event)=>{
                    if (event.detail.resource.startsWith("component:")) {
                        this.refresh();
                    }
                });
                this.refresh();
            },
            async refresh() {
                // refresh
                state.areas = areas.getAreas();
                // traverse the DOM to build the page hierarchy
                let traverse = (node, parent) => {
                    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                        if (node.localName === "x-page") {
                            let item = {
                                src: node.src,
                                label: node.label || "?",
                                icon: node.icon,
                                layout: node.layout, 
                                loading: node.loading || '', 
                                status: node.status,
                                module: areas.getModuleId(node.src),
                                time: (node.stats && node.stats.loadTime ? node.stats.loadTime : -1),
                                size: (node.stats && node.stats.loadSize ? node.stats.loadSize : -1),
                                children:[],
                            }
                            parent.children.push(item)
                            parent = item;
                        }
                        for (let child of node.childNodes) {
                            traverse(child, parent);
                        }
                        if (node.shadowRoot) {
                            traverse(node.shadowRoot, parent);
                        }
                    }
                }
                let root = {children:[]}
                traverse(document.body, root)
                state.children = root.children;
                // Show each menu's metadata and effective items alongside its Area and name.
                const menus = [];
                for (const area of state.areas) {
                    for (const menu of Object.values(area.menus)) {
                        menus.push({ ...menu, id: area.id + "/" + menu.name });
                    }
                }
                state.menus = menus;

                // list composed routes in Area and declaration order, with optional filters
                const routes = [];
                for (const area of state.areas) {
                    if (!area.id.includes(state.query_area)) continue;
                    for (const route of area.routes) {
                        const path = area.prefix + route.path;
                        if (!path.includes(state.query_path) || !route.href.includes(state.query_destination) ||
                            !route.module.includes(state.query_module)) continue;
                        // declarations have already been validated; show placeholders in declaration order
                        const parameters = Array.from(route.path.matchAll(/\{([^}]+)\}/g), match => match[1]).join(", ");
                        routes.push({ areaId: area.id, path, href: route.href, module: route.module, parameters });
                    }
                }
                state.routes = routes;
            },
            resolveRoute() {
                // display the match, no-match notice, or error from Navigation
                state.test_result = null;
                state.test_info = "";
                state.test_error = "";
                try {
                    const result = navigation.resolveRoute(state.test_route);
                    if (result) state.test_result = result;
                    else state.test_info = "No configured route matched the path.";
                } catch (error) {
                    state.test_error = error.message;
                }
            }
        };
    }
}
