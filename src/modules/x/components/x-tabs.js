import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-tabs", {
    style: `
        :host {bdisplay:block;}
        x-menu {margin-bottom:1.5em;}

        ::slotted(x-tab) {
            display:none;
        }
    `,
    state: {
        selectedIndex: 0,
        tabs: []
    },
    template: `
        <style x-html="state.style"></style>
        <x-menu class="tabs">
            <x-menuitem x-for="(tab,index) in state.tabs" 
                x-attr:label="tab.label" 
                x-attr:icon="tab.icon" 
                x-attr:selected="index == state.selectedIndex" 
                x-attr:class="(index == state.selectedIndex ? 'tab selected' : 'tab')" 
                x-on:click="clicked">
            </x-menuitem>
        </x-menu>
        <slot x-on:slotchange="refresh"></slot>
    `,
    settings: {
        observedAttributes: ["selected-index"],
    },
    methods:{
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "clicked") {
                //clicked
                var event = args;
                this.state.selectedIndex = Array.from(this.shadowRoot.querySelectorAll(":scope x-menu x-menuitem")).indexOf(event.target);
                this.onCommand("refresh");
                event.preventDefault();
                
            } else if (command == "refresh") {
                //refresh
                let tabs = [];
                this.querySelectorAll(":scope > x-tab").forEach(tab => {
                    tabs.push({
                        label: tab.getAttribute("label"),
                        icon: tab.getAttribute("icon") || ""
                    });
                });
                this.state.tabs = tabs;
                this.state.style = `::slotted(x-tab:nth-child(${parseInt(this.state.selectedIndex) + 1})) {display:block;}`;
            }
        }
    }
});

