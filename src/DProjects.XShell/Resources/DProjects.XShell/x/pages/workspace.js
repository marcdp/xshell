
export default {
    contract: {
        description: "Workspace menu and pages.",
        properties: {
            menuName: {type:"string", default:"", state:true, query:true},
            src: {type:"string", default:null, state:true, query:true, reflect:true},
            showTitle: {type:"boolean", default:true, state:true, query:true}
        }
    },

    meta: {
        title:"Workspace", 
        description: "Workspace menu and pages.",
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
                <h4 x-if="state.showTitle">{{state.title}}</h4>
                <x-page outlet="content" x-attr:src="state.src" x-on:load="refresh" x-once></x-page>
            </div>
        </div>

    `,

    state: {
        menu: [],
        title: null,
        src: null
    },

    controller({state, areas, page}) {

        return {
            load() {
                // Use the named menu for the outer Page metadata and sidebar items.
                const menu = areas.getMenu(state.menuName);
                state.menu = menu?.items || [];
                if (!menu) return;
                page.label = menu.label;
                page.description = menu.description;
                page.icon = menu.icon;

                // Keep a query-supplied source or open the first item with a Page target.
                if (!state.src) {
                    state.src = this.findFirstHref(state.menu);
                }
            },
            findFirstHref(items) {
                // Walk each branch before moving to the next sibling.
                for (const item of items) {
                    const href = item.href || this.findFirstHref(item.children || []);
                    if (href) return href;
                }
                return null;
            },
            refresh( {event } ) {
                // Reflect the embedded Page source and update its heading.
                state.src = event.detail.page.src;
                state.title = event.detail.page.label;
            }
        }

    }
};
