// contract
export const contract = {
    description: "Contracts page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    meta: {
        title: "Contracts"
    },
    template: `
        <p>Shows discovered contracts, their owning framework or module package, metadata, size, load time, and status.</p>
        <x-listview view="details">
            <x-listview-head>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.id" placeholder="Contract"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Time" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Status" width="5em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="contractItem in state.contractItems"
                x-attr:href="contractItem.url" 
                x-attr:label="contractItem.id"
                x-attr:icon="contractItem.icon || 'x-contract'"
                target="_blank"
            >
                <div>{{ contractItem.label }}</div>
                <x-truncate x-attr:text="contractItem.description"></x-truncate>
                <div>{{ contractItem.moduleId }}</div>
                <x-file-size x-prop:value="contractItem.size" style="text-align:right"></x-file-size>
                <x-time-ms x-prop:value="contractItem.time" style="text-align:right"></x-time-ms>
                <div style="text-align:right">{{ contractItem.status }}</div>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,    
    state:{
        id: "",
        label: "",
        description: "",
        moduleId: "",
        contractItems: []
    },
    controller({ state, events, contracts}) {
        return {
            load() {
               // load
               this.refresh();
               events.on(state, "change:id", "refresh");
               events.on(state, "change:moduleId", "refresh");
               events.on(state, "change:description", "refresh");
               events.on(state, "change:label", "refresh");
            },
            async refresh() {
                // refresh
                const contractItems = [];
                for (const item of contracts.registry) {
                    let valid = true;
                    if (state.id && !item.id.includes(state.id)) {
                        valid = false;
                    }
                    if (state.label && !item.label.includes(state.label)) {
                        valid = false;
                    }
                    if (state.description && !item.description.includes(state.description)) {
                        valid = false;
                    }
                    if (state.moduleId && !item.moduleId.includes(state.moduleId)) {
                        valid = false;
                    }
                    if (valid) {
                        contractItems.push(item);
                    }
                }
                state.contractItems = contractItems;
            }
        };
    }
}
