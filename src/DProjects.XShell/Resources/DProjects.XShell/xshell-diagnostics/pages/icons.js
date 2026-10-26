// contract
export const contract = {
    description: "Icons page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    meta: {
        title: "Icons"
    },
    template: `
        <p>Shows available icons by module together with their size, load time, and status.</p>
        <x-listview view="details" views="list,details,tiles,icons">
            <x-listview-head>
                <x-listview-column><x-datafield type="search" x-model="state.id" placeholder="Icon"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="item in state.items"
                x-attr:href="item.url" 
                x-attr:label="item.id"
                x-attr:icon="item.id"
                x-attr:description="item.moduleId"
                x-attr:category="item.category"
                target="_blank"
            >
                <div>{{ item.moduleId }}</div>
                <x-file-size x-prop:value="item.size" style="text-align:right"></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="item.time"></x-time-ms></div>
                <div style="text-align:right">{{ item.status }}</div>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        moduleId: "",
        items: null
    },
    controller({ state, events, config, bus, loader}) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:moduleId", "refresh");
               events.on(bus, "xshell:loader:resource:loaded", (event)=>{
                    if (event.detail.resource.startsWith("icon:")) {
                        this.refresh();
                    }
                });
            },
            async refresh() {
                // refresh
                let items = [];
                let loaderRegistryCache = {};
                for (const loaderRegistryItem of loader.registry) {
                    loaderRegistryCache[loaderRegistryItem.resource] = loaderRegistryItem;
                }
                for(let moduleId of Object.keys(config.modules)) {
                    const moduleConfig = config.modules[moduleId];
                    let moduleIconsPath = moduleConfig.assets.path + "/icons";
                    for(const file of Object.values(moduleConfig.files)) {
                        if (file.path.startsWith(moduleIconsPath)) {
                            const id = (file.path.split("/").pop() || "").split(".")[0];    
                            const url = new URL(file.path.replace(/^\/+/, ""), config.app.baseUrl).href;
                            await loader.load("icon:" + id);
                            const loaderRegistryItem = loaderRegistryCache["icon:" + id];
                            let valid = true;
                            if (state.id && id.indexOf(state.id) == -1 ) valid = false;
                            if (state.moduleId && moduleId.indexOf(state.moduleId) == -1 ) valid = false;
                            if (valid) {
                                items.push({
                                    id: id,
                                    url: url,
                                    moduleId: moduleId,
                                    category: moduleConfig.label,
                                    status: "loaded",
                                    time: loaderRegistryItem?.time || 0,
                                    size: file.size
                                });
                            }
                        }                        
                    }
                };
                state.items = items;
            }
        };
    }
}
