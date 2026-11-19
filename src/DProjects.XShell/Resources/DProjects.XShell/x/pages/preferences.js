
export default {
    contract: {
        description: "Manage browser-local preferences.",
        properties: {
            src: { type: "string", default: null, state: true, query: true, reflect:true },
        }
    },

    meta: {
        title:"Preferences", 
        description: "Manage browser-local preferences.",
        icon:"x-settings",
        classes: ["size-medium", "layout-fill"]
    },

    style: `
        :scope {height:100%;}
        :scope > div {display:flex; flex-direction: row; flex:1;}
        :scope > div .menu-container {min-width:16; width:18em; background:var(--x-layout-main-drawer-background); padding:1em}
        :scope > div x-splitter {opacity:0;}
        :scope > div .page-container {display:block; padding-left:1.5em; flex:1;}
        :scope > div .page-container h1 {margin-top:0;}        
    `,

    template: `
        <div>
            <div class="menu-container">
                <x-menuitem x-recursive="menuitem in state.menu" 
                    x-key="id,href,path,command,order" 
                    x-attr:label="menuitem.label" 
                    x-attr:href="menuitem.path || menuitem.href" 
                    x-attr:command="menuitem.command"
                    x-attr:icon="menuitem.icon"                     
                    x-attr:class="menuitem.class"
                    x-attr:tooltip="menuitem.tooltip" 
                    x-attr:selected="(menuitem.href && menuitem.href == state.src ? true : false)" 
                    open="embed"
                    outlet="content"
                    >                
                </x-menuitem>
            </div>
            
            <x-splitter></x-splitter>

            <div class="page-container">
                <h4>{{state.title}}</h4>
                <x-page outlet="content" x-attr:src="state.src" x-on:load="refresh" x-once></x-page>
            </div>
        </div>

    `,

    state: {
        menu: null,
        title: null,
        src: null
    },

    controller({state, areas, page}) {

        return {
            load() {
                // load
                state.menu = areas.getGlobalMenu("preferences");
                // load first menu item
                if (!state.src) {
                    const findFirstMenuItem = (menu) => {
                        for (const item of menu) {
                            if (item.href) return item;
                            if (item.children) {
                                const found = findFirstMenuItem(item.children);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const firstMenuItem = findFirstMenuItem(state.menu);
                    if (firstMenuItem) {
                        state.src = firstMenuItem.href || firstMenuItem.path;
                    }
                }
            },
            refresh( {event } ) {
                // set src
                state.src = event.detail.page.src;
                state.title = event.detail.page.label;
            }
        }

    }
};
