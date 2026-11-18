// page
export default {
    contract: {
        description: "Diagnostics console page",
        events: {},
        properties: {},
        methods: {},
        events: {
            toggleDock: {
                description: "Toggle the dock panel"
            }
        }
    },
    meta: {
        title: "Diagnostics console"
    },
    style: `
        x-page {height:100%; overflow:auto; padding:.1em;}
    `,
    template: `
        <x-toolbar slot="header-actions">
            <x-button x-for="(menuitem,index) in state.menuitems" 
                command="selectTab" 
                x-attr:label="menuitem.label" 
                x-attr:class="'menuitem ' + (index == state.selectedIndex ? 'pressed' : '')"
                x-attr:data-index="index" 
            ></x-button>
        </x-toolbar>
        <x-tabs x-attr:selected-index="state.selectedIndex" class="no-header">
            <x-tab x-for="menuitem in state.menuitems" x-attr:label="menuitem.label" >
                <x-page x-attr:src="menuitem.href" loading="lazy"></x-page>
            </x-tab>
        </x-tabs>        
    `,    
    state: {
        menuitems: [],
        selectedIndex: 0
    },
    controller({ state, areas, page, preferences }) {
        return {
            async load() {
               // load
               const area = areas.getArea("xshell-diagnostics");
               const menuitems = area.menus.navigation[0].children;
               state.menuitems = menuitems;
               state.selectedIndex = await preferences.get("xshell-diagnostics.selectedIndex", 0);
            },

            // events
            async selectTab(data){
                state.selectedIndex = parseInt(data.index);
                await preferences.set("xshell-diagnostics.selectedIndex", state.selectedIndex);
            }
        };
    }
}
