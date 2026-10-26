// contract
export const contract = {
    description: "Services page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    meta: {
        title: "Services"
    },
    template: `
        <p>Shows registered services, their modules and contracts, resource metadata, and load status.</p>
        <x-listview2 view="details">
            <x-listview2-head>
                <x-listview2-column width="10em"><x-datafield type="search" x-model="state.id" placeholder="Service"></x-datafield></x-listview2-column>
                <x-listview2-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview2-column>
                <x-listview2-column width="10em"><x-datafield type="search" x-model="state.contractId" placeholder="Contract"></x-datafield></x-listview2-column>
                <x-listview2-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview2-column>
                <x-listview2-column label="Size" width="5em" style="text-align:right"></x-listview2-column>
                <x-listview2-column label="Time" width="5em" style="text-align:right"></x-listview2-column>
                <x-listview2-column label="Status" width="5em" style="text-align:right"></x-listview2-column>
            </x-listview2-head>
            <x-listview2-body>
            <x-listview2-item x-for="item in state.items" x-attr:href="item.url" x-attr:label="item.serviceId" x-attr:icon="item.icon" target="_blank">
                <div>{{ item.moduleId }}</div>
                <div>
                    <x-anchor x-if="item.contractUrl" x-attr:href="item.contractUrl" target="_blank" class="plain">
                        {{ item.contractId }}
                    </x-anchor>
                    <span x-if="!item.contractUrl">{{ item.contractId }}</span>
                </div>
                <x-truncate x-attr:text="item.description"></x-truncate>
                <x-file-size style="text-align:right" x-prop:value="item.size" ></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="item.time"></x-time-ms></div>
                <div style="text-align:right">{{ item.status }}</div>
            </x-listview2-item>
            </x-listview2-body>
        </x-listview2>
    `,    
    state:{
        id: "",
        moduleId: "",
        contractId: "",
        description: "",
        items: []
    },
    controller({ state, events, services, bus, config}) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:moduleId", "refresh");
               events.on(state, "change:contractId", "refresh");
               events.on(state, "change:description", "refresh");
               events.on(bus, "xshell:service:created", "refresh");
            },
            async refresh() {
                // refresh
                const list = [];
                for (const item of services.registry) {
                    const contractId = item.contractId || "";
                    const description = item.description || (item.url
                        ? `Configured service (${item.implementationName || "implementation"}).`
                        : "Runtime service.");
                    const moduleId = item.moduleId || (item.url ? "-" : "xshell");
                    let valid = true;
                    if (state.id && !item.id.includes(state.id)) {
                        valid = false;
                    }
                    if (state.contractId && !contractId.includes(state.contractId)) {
                        valid = false;
                    }
                    if (state.description && !description.includes(state.description)) {
                        valid = false;
                    }
                    if (state.moduleId && !moduleId.includes(state.moduleId)) {
                        valid = false;
                    }
                    if (valid) {
                        list.push({
                            serviceId: item.id,
                            icon: item.icon || "x-service",
                            contractUrl: item.contractUrl,
                            contractId: contractId || "",
                            description: description,
                            moduleId: moduleId,
                            url: item.url,
                            status: item.state,
                            size: item.size ?? 0,
                            time: item.time ?? 0,
                        });
                    }
                }
                state.items = list;
            }
        };
    }
}
