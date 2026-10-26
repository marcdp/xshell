// contract
export const contract = {
    description: "Shows the available areas for navigation.",
    events: {},
    properties: {},
    methods: {}
};


// implementation
export default {
    meta: {
        title: "Areas selector"
    },
    template: `
        <p>
            Please select the area to navigate:
        </p>        
        <x-listview2 view="tiles">
            <x-listview2-head></x-listview2-head>
            <x-listview2-body>
                <x-listview2-item
                    x-for="area in state.areas"
                    x-prop:selected="state.selected == area.id"
                    x-attr:label="area.label"
                    x-attr:description="area.description"
                    x-attr:icon="area.icon"
                    x-attr:href="area.home"
                    open="top"
                ></x-listview2-item>
            </x-listview2-body>
        </x-listview2>
    `,    
    state: {
        areas: [],
        selected: ""
    },
    controller({ state, events, bus, areas }) {
        return {
            load() {
                // load
                events.on(bus, "xshell:area:change", "refresh");
                state.areas = areas.getAreas();
                this.refresh();
            },

            refresh() {
                // refresh selected area
                let currentArea = areas.getCurrentArea();
                if (currentArea) {
                    state.selected = currentArea.id;
                }
            }
        };
    }
}
