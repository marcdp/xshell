// component
export default {
    contract: {
        description: "Renders menu data as menu items.",
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
                    {label: "Areas", icon: "x-folder", href: "page:x:/pages/areas.js"},
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
            <x-menuitem x-recursive="menuitem in state.menu" 
                x-key="id,href,path,command,order" 
                x-attr:embedded="menuitem.embedded" 
                x-attr:label="menuitem.label" 
                x-attr:href="menuitem.path || menuitem.href" 
                x-attr:command="menuitem.command"
                x-attr:icon="menuitem.icon" 
                x-attr:selected="menuitem.selected" 
                x-attr:class="menuitem.class"
                x-attr:tooltip="menuitem.tooltip" 
                x-attr:open="menuitem.open"
                x-attr:outlet="menuitem.outlet"
                >                
            </x-menuitem>
        </nav>        
    `
};

