import XElement from "../ui/x-element.js";
import xshell from "./../../../x-shell.js";
import bus from "../../../bus.js";

// class
export default XElement.define("x-app-menu", {
    style: `
        :host {}
        x-button + x-button {margin-left:.25em;}
    `,
    template: `
        <x-button x-for="menuitem in state.menuitems" 
            class="plain"
            x-attr:icon="menuitem.icon"
            x-attr:label="menuitem.label"
            x-attr:command="menuitem.command"
            x-attr:selected="menuitem.selected"
            x-attr:href="menuitem.href">                
            <x-contextmenu x-if="menuitem.children">
                <x-menu-item x-for="submenuitem in menuitem.children" x-prop:menuitem="submenuitem"></x-menu-item>
            </x-contextmenu>
        </x-button>
    `, 
    state: {
        menu: null,
        menuitems: []
    },
    settings: {
        observedAttributes: ["menu"]
    },
    methods:{
        onNavigationEnd(event) {
            let href = event.page.src;
            let breadcrumb = event.page.breadcrumb;
            if (breadcrumb.length) href = breadcrumb[0].href;
            let names = ["x-menu-item", "x-button"];
            this.shadowRoot.querySelectorAll(names.join(", ")).forEach((element) => {
                if (element.href == href) {
                    element.classList.add("selected");
                    let target = element;
                    while (target != this && target != null){
                        if (names.indexOf(target.localName)!=-1) {
                            target.classList.add("selected");
                        }
                        target = target.parentNode;
                    }
                } else {
                    element.classList.remove("selected");
                }
            });
        },
        onStateChanged(name, oldValue, newValue) {
            if (name == "menu") {
                this.state.menuitems = xshell.config.menus[newValue];
            }
        },
        onCommand(command) {
            if (command == "load") {
                // create method bind
                this.onNavigationEnd = this.onNavigationEnd.bind(this);
                // add navigation listener
                bus.on("navigation:end", this.onNavigationEnd);

            } else if (command == "unload") {
                // remove navigation listener
                bus.off("navigation:end", this.onNavigationEnd);
            }
        },
    }

});

