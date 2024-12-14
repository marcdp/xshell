import XElement from "../ui/x-element.js";
import config from "./../../../config.js";
import bus from "../../../bus.js";

// class
export default XElement.define("x-app-menu", {
    style: `
        :host {display:flex; gap:.1em .2em; flex-direction:column;
            --x-button-justify-content:start;
            --x-background-x-gray:white;
        }
        
        @media only screen and (max-width: 768px) {
            :host {display:flex; flex-direction:column; }
        }
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
                <x-menuitem x-for="submenuitem in menuitem.children" x-prop:menuitem="submenuitem"></x-menuitem>
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
            let names = ["x-menuitem", "x-button"];
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
                this.state.menuitems = mpaShell.config.menus[newValue];
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

