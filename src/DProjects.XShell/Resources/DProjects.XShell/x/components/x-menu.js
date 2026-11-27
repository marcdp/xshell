import { bindMenuPresenter, getMenuShortcutHints } from "../utils/menu-presenter.js";

// component
export default {
    contract: {
        description: "Renders menu data as menu items.",
        tags: ["navigation", "menus"],
        events: {},
        properties: {
            menu: {type:"array", default:null, attribute:false, state:true, description:""},
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Bind an array of navigation items to the menu.",
                state: {items: [
                    {label: "Global", icon: "x-folder", href: "page:x:/pages/global.js"},
                    {label: "Tasks", href: "page:x:/pages/tasks.js"}
                ]},
                template: `<x-menu x-prop:menu="state.items"></x-menu>`
            },
            {
                name: "nested-items",
                description: "Group child links and open Tasks in a stack.",
                state: {items: [{id: "tools", label: "Tools", children: [
                    {label: "Tasks", href: "page:x:/pages/tasks.js", open: "stack"},
                    {label: "About", href: "page:x:/pages/about.js"}
                ]}]},
                template: `<x-menu x-prop:menu="state.items"></x-menu>`
            }
        ]
    },
    style: `
        :host {display: block;}
        :host(.horizontal) {display:flex; align-items:center; }
        :host(.horizontal) nav {display:flex; align-items:center;}
        :host(.horizontal) nav > x-menuitem {margin-right: 1em;}
        :host(x-menu) x-menuitem[label="-"] {}
    `,
    template: `
        <nav x-if="state.menu" x-attr:class="state.horizontal ? 'horizontal' : ''">
            <x-menuitem x-recursive="(menuitem,index,indexAbsolute) in state.menu"
                x-key="id,href,path,command,order" 
                x-attr:data-menu-index="menuitem.shortcut ? indexAbsolute : null"
                x-attr:label="menuitem.label" 
                x-attr:href="menuitem.open == 'embed' && menuitem.outlet == 'self' ? menuitem.href : menuitem.path || menuitem.href"
                x-attr:target="menuitem.target"
                x-attr:command="menuitem.command"
                x-attr:shortcut="state.shortcutHints[indexAbsolute]"
                x-attr:disabled="menuitem.disabled"
                x-attr:icon="menuitem.icon" 
                x-attr:selected="menuitem.selected" 
                x-attr:class="menuitem.class"
                x-attr:tooltip="menuitem.tooltip" 
                x-attr:open="menuitem.open"
                x-attr:outlet="menuitem.outlet"
                >                
            </x-menuitem>
        </nav>        
    `,
    state: {
        shortcutHints: []
    },
    controller({host, state, services, postRender}) {
        return {
            mount() {
                postRender("bindMenu");
            },
            stateChange({changes}) {
                // Update hints in the same render as the supplied menu.
                if (!changes.some(change => change.prop === "menu")) return;
                state.shortcutHints = getMenuShortcutHints(state.menu);
                if (this._releaseMenu) postRender("bindMenu");
            },
            unmount() {
                this._releaseMenu?.();
                this._releaseMenu = null;
            },
            bindMenu() {
                // Associate controls with the rendered menu after the DOM has caught up.
                this._releaseMenu?.();
                this._releaseMenu = bindMenuPresenter(host.shadowRoot, state.menu, services);
            }
        };
    }
};

