// page
export default {
    contract: {
        description: "Services page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Services"
    },
    template: `
        <p>Shows registered services, their modules and contracts, resource metadata, and load status.</p>
        <x-listview view="details" x-on:activate="inspectService">
            <x-listview-head>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.id" placeholder="Service"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.contractId" placeholder="Contract"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Initialization" width="8em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="item in state.items" x-attr:label="item.serviceId" x-attr:icon="item.icon" x-prop:value="item.serviceId">
                <div>{{ item.moduleId }}</div>
                <div>
                    {{ item.contractId }}
                    <x-anchor x-if="item.contractUrl" x-attr:href="item.contractUrl" target="_blank" class="plain"
                        x-on:dblclick="keepLinkActivation" x-on:keydown.enter="keepLinkActivation">
                        <x-icon icon="x-open-in-new" ></x-icon>
                    </x-anchor>
                </div>
                <x-truncate x-attr:text="item.description"></x-truncate>
                <x-file-size style="text-align:right" x-prop:value="item.size" ></x-file-size>
                <div style="text-align:right"><x-time-ms x-prop:value="item.time"></x-time-ms></div>
                <div style="text-align:right">{{ item.status }}</div>
                <div style="text-align:right">{{ item.initializationStatus }}</div>
                <x-anchor style="text-align:right" x-if="item.url" x-attr:href="item.url" target="_blank" class="plain"
                    x-on:dblclick="keepLinkActivation" x-on:keydown.enter="keepLinkActivation"><x-icon icon="x-open-in-new"></x-icon></x-anchor>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        moduleId: "",
        contractId: "",
        description: "",
        items: []
    },
    controller({ state, events, services, bus, navigation, page }) {
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
            inspectService({ event }) {
                // Open the Inspector for the activated registry entry.
                const serviceId = event.detail?.value;
                if (typeof serviceId !== "string" || !serviceId.trim() || !services.has(serviceId)) return;
                return navigation.navigate({
                    href: "page:xshell-diagnostics:/pages/detail/service-inspector.js",
                    page,
                    open: "stack",
                    params: { service: serviceId }
                });
            },
            keepLinkActivation({ event }) {
                event.stopPropagation();
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
                            initializationStatus: item.initializationState,
                            size: item.size ?? 0,
                            time: item.time ?? 0,
                        });
                    }
                }
                list.sort((a, b) => a.serviceId.localeCompare(b.serviceId));
                state.items = list;
            }
        };
    }
}
