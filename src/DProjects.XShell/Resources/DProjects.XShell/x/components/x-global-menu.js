
// component
export default {
    contract: {
        description: "Displays the global menu.",
        tags: ["navigation", "menus", "pages"],
        events: {},
        properties: {
            expanded: {type: "boolean", default:false, attribute: true, state: true, description: "Indicates whether the global menu is expanded."}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Place the effective global menu in a window sidebar.",
                template: `<x-global-menu></x-global-menu>`
            }
        ]
    },
    style: `
        :host {display:flex; flex-direction: row;}
        div {
            display:flex; background:var(--x-layout-main-drawer-background); border-right: var(--x-layout-main-border); flex-direction: column;
            height:100%;
            box-sizing: border-box;
            padding:.5em;
            padding-bottom:1em;
        }
        div span {flex: 1;}
    `,
    template: `
        <div>
            <x-menuitem x-recursive="(menuitem,index,indexAbsolute,indent) in state.menuGlobal"
                x-key="id,href,path,command,order"
                x-attr:embedded="menuitem.embedded"
                x-attr:label="menuitem.label"
                x-attr:href="menuitem.path || menuitem.href"
                x-attr:command="menuitem.command"
                x-attr:icon="menuitem.icon"
                x-attr:selected="(indent==0 && menuitem.ref == state.selected)"
                x-attr:class="(indent==0 && !state.expanded ? 'icon' : menuitem.class)"
                x-attr:tooltip="menuitem.tooltip"
                x-attr:open="menuitem.open"
                x-attr:outlet="menuitem.outlet"
                >
            </x-menuitem>
            <span></span>
            <x-menuitem x-recursive="(menuitem,index,indexAbsolute,indent) in state.menuShortcuts"
                x-key="id,href,path,command,order"
                x-attr:embedded="menuitem.embedded"
                x-attr:label="menuitem.label"
                x-attr:href="menuitem.path || menuitem.href"
                x-attr:command="menuitem.command"
                x-attr:icon="menuitem.icon"
                x-attr:selected="(indent==0 && menuitem.ref == state.selected)"
                x-attr:class="(indent==0 && !state.expanded ? 'icon' : menuitem.class)"
                x-attr:tooltip="menuitem.tooltip"
                x-attr:open="menuitem.open"
                x-attr:outlet="menuitem.outlet"
                >
            </x-menuitem>
        </div>

    `,
    state: {
        expanded: false,
        selected: "",
        menuGlobal: null,
        menuShortcuts: null
    },
    controller({ events, bus, state, getPage, areas, navigation }) {
        return {
            load() {
                // load
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:page:load", (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.refresh();
                    }
                });
                events.on(bus, "xshell:navigation:end", (event) => {
                    let href = event.detail.src;
                    if (href.indexOf("#")!=-1) href = href.substring(0, href.indexOf("#"));
                    if (href.indexOf("?")!=-1) href = href.substring(0, href.indexOf("?"));
                    state.selected = href;
                })

                let href = navigation.src;
                if (href.indexOf("#")!=-1) href = href.substring(0, href.indexOf("#"));
                if (href.indexOf("?")!=-1) href = href.substring(0, href.indexOf("?"));
                state.selected = href;
            },

            mount() {
                // mount
                this.refresh();
            },

            refresh() {
                //refresh
                state.menuGlobal = areas.getMenu("global").items;
                state.menuShortcuts = areas.getMenu("shortcuts").items;
            }
        }
    }
};
