// page
export default {
    contract: {
        description: "Index page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Debug",
        classes: ["width70"]
    },
    style: `
    `,
    template: `
        <p>Provides access to the available XShell diagnostic views.</p>
        <x-tabs use-hash="true">
            <x-tab x-for="menuitem in state.menuitems" x-attr:label="menuitem.label" x-attr:hash="menuitem.label | slug" >
                <x-page x-attr:src="menuitem.href" loading="lazy"></x-page>
            </x-tab>
        </x-tabs>        
    `,    
    state: {
        menuitems: []
    },
    controller({ state, areas }) {
        return {
            load() {
               // load
               const area = areas.getArea("xshell-diagnostics");
               const menuitems = area.menus.navigation[0].children;
               state.menuitems = menuitems;
            }
        };
    }
}
