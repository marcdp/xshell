// page
export default {
    contract: {
        description: "Shows the available areas for navigation.",
        events: {},
        properties: {},
        methods: {},
        examples: [
            {
                name: "browse-areas",
                description: "Open the Area selector over the current Page.",
                language: "javascript",
                code: `
                    await navigation.navigate({
                        href: "page:x:/pages/areas.js",
                        page,
                        open: "stack"
                    });
                `
            }
        ]
    },
    meta: {
        title: "Areas selector",
        description: "Please select the area to navigate:"
    },
    template: `
        <x-listview view="tiles">
            <x-listview-head></x-listview-head>
            <x-listview-body>
                <x-listview-item
                    x-for="area in state.areas"
                    x-prop:selected="state.selected == area.id"
                    x-attr:label="area.label"
                    x-attr:description="area.description"
                    x-attr:icon="area.icon"
                    x-attr:href="area.home"
                    open="top"
                ></x-listview-item>
            </x-listview-body>
        </x-listview>
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
