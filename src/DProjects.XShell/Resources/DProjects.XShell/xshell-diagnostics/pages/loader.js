// contract
export const contract = {
    description: "Loader page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    meta: {
        title: "Loader"
    },
    template: `
        <p>Shows resources processed by the XShell loader together with their module, size, load time, and status.</p>
        <x-listview view="details" auto-scroll>
            <x-listview-head>
                <x-listview-column><x-datafield type="search" x-model="state.query_resource" placeholder="Resource"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.query_module" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column width="2em"><x-button class="plain" command="clear" icon="x-clear" title="Clear list contents"></x-button></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="item in state.items" x-attr:label="item.resource" icon="x-file" x-attr:href="item.url" target="_blank">
                <div>{{ item.moduleId }}</div>
                <x-file-size x-prop:value="item.size" style="text-align:right"></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="item.time"></x-time-ms></div>
                <div style="text-align:right">{{ item.status }}</div>
                <div></div>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        items: [],
        query_resource: "",
        query_module: "",
        query_url: "",
        query_status: ""
    },
    controller({ state, events, loader, bus, page }) {
        let clearedCount = 0;
        return {
            load() {
                // load
                events.on(state, "change:query_resource", "refresh");
                events.on(state, "change:query_module", "refresh");
                events.on(state, "change:query_url", "refresh");
                events.on(state, "change:query_status", "refresh");

                // re-read the loader snapshot whenever tracked resources change
                this.refresh();
                events.on(bus, "xshell:loader:resource:fetch", "refresh");
                events.on(bus, "xshell:loader:resource:loaded", "refresh");
                events.on(bus, "xshell:loader:resource:error", "refresh");
            },
            clear() {
                clearedCount = loader.registry.length;
                this.refresh();
            },
            refresh() {
                // derive the visible rows from current loader state and local filters
                state.items = loader.registry.slice(clearedCount).filter(item =>
                    (!state.query_resource || item.resource.includes(state.query_resource)) &&
                    (!state.query_module || item.moduleId?.includes(state.query_module)) &&
                    (!state.query_url || item.url.includes(state.query_url)) &&
                    (!state.query_status || item.status.includes(state.query_status))
                );
                page.invalidate();
            }
        };
    }
}
