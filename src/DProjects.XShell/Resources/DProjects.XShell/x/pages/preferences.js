
export default {
    contract: {
        description: "Manage browser-local preferences.",
        properties: {
            src: { type: "string", default: null, state: true, query: true, reflect:true },
        }
    },

    meta: {
        title:"Preferences", 
        icon:"x-settings"
    },

    style: `
        :scope {}
        :scope > div {display:flex; flex-direction: row; width:100%;}
        :scope > div .menu-container {min-width:15em;}
        :scope > div x-splitter {margin: 0 .5em;}
        :scope > div .page-container {display:block; min-width:50%; max-width:80%;}
        :scope > div .page-container h1 {margin-top:0;}
        
    `,

    template: `
        <div>
            <div class="menu-container">
                <x-menuitem x-recursive="menuitem in state.menu" 
                    x-key="href" 
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
                <h1>{{state.title}}</h1>
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
