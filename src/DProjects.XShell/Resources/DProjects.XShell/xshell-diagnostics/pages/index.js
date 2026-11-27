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
        title: "Diagnostics console",
        description: "Provides an overview and access to various diagnostics tools and information."
    },
    style: `
        x-page {height:100%; overflow:auto; padding:.1em;}
    `,
    template: `
        <x-button slot="header-actions" x-for="(menuitem,index) in state.menuitems" 
            command="selectTab" 
            x-attr:label="menuitem.label" 
            x-attr:class="'menuitem ' + (index == state.selectedIndex ? 'pressed' : '')"
            x-attr:data-index="index" 
        ></x-button>
        
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
    controller({ state, menus, page, preferences }) {
        return {
            async load() {
               // load
               const menuitems = (menus.getMenu("navigation", "xshell-diagnostics")?.items[0]?.children || []).filter(item => item.href);
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
