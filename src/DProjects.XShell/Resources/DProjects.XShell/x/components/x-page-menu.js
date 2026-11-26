
// component
export default {
    contract: {
        description: "Displays the main area menu for the current page.",
        tags: ["navigation", "menus", "pages"],
        events: {},
        properties: {
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Place the effective navigation menu in a Page sidebar.",
                template: `<x-page-menu></x-page-menu>`
            }
        ]
    },
    style: `
        :host {
            display:block;
            overflow-y:auto;
            height:100%;
            width: var(--x-layout-main-drawer-width);           
            transition: width var(--x-transition-duration) ease;
        }

        nav {
            border-left: var(--x-layout-main-border); 
            padding:1.3em; 
            min-height:100%;
            box-sizing: border-box;
            width: var(--x-layout-main-drawer-width);           
        }
        ul {margin:0; padding:0;}
        li {list-style:none; }
        li > x-anchor {display:block; padding-bottom:.5em;}
        li > li > li  {padding-left:1.5em;}
        ul > li > ul > li > ul {padding-left:1.25em;}
        hr {border-top:var(--x-layout-main-border); margin-top:1.5em; margin-bottom:1.5em; display:block;}
        :host > nav > ul > li + li {margin-top:1.5em; }
        :host > nav > ul > li > x-anchor {font-size:var(--x-font-size-subtitle); font-weight:500!important; display:block; margin-bottom:.5em; }
        x-icon.new {padding-left:.15em; display:inline-block; transform: translateY(-.1em);}
        x-anchor.selected {font-weight:600; }     

        :host(.collapsed) {width:0em!important; overflow-x:hidden;}
        
    `,
    template: `
        <nav>
            <ul x-if="state.menu">
                <li class="menuitem new" x-recursive="menuitem in state.menu" x-key="id,href,path,command,order" x-recursive-wrapper="ul">
                    <hr x-if="menuitem.label=='-'" />
                    <x-anchor x-else x-attr:href="menuitem.path || menuitem.href" x-attr:target="menuitem.target" x-attr:icon="menuitem.icon" x-attr:tooltip="menuitem.tooltip || menuitem.description" class="plain block" x-class:selected="state.selected == menuitem.href || (menuitem.path && state.selected == menuitem.path)" >
                        <x-icon x-if="menuitem.icon" x-attr:icon="menuitem.icon"></x-icon>
                        <span x-text="menuitem.label"></span>
                        <x-icon x-if="menuitem.target" class="new" icon="x-open-in-new"></x-icon>
                    </x-anchor>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </li>
            </ul>
        </nav>
    `,
    state: {
        collapsed: false,
        selected: "",
        menu: null
    },
    controller({ events, bus, state, getPage, areas }) {
        return {
            load() {
                // Refresh the owning Page's menu after navigation or menu composition changes.
                events.on(bus, "xshell:area:change", "refresh");
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:page:load", (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.refresh();
                    }
                });
                events.on(bus, "xshell:navigation:end", "refresh");
            },

            mount() {
                // mount
                this.refresh();
            },

            refresh() {
                // Resolve the menu and selection from the same Page source.
                const src = getPage()?.src || "";
                const areaId = areas.resolveAreaId(src);
                state.menu = areaId ? areas.getMenu("navigation", areaId)?.items || [] : [];
                state.selected = src.split(/[?#]/, 1)[0];
            }
        }
    }
};

