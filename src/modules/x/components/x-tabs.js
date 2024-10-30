import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-tabs", {
    style: `
        :host {display:block; margin-bottom:1.5em;}
        
        nav {margin-bottom:1.5em;}
        nav x-anchor {padding-bottom:.5em; margin-right:1em; cursor:pointer; position:relative; }
        nav x-anchor:after {content:""; border-radius:.1em; position:absolute; width:calc(100% - .25em); bottom:0; left:0; }
        nav x-anchor:hover::after {border:.125em var(--x-background-xxx-gray) solid;}
        nav x-anchor.selected {font-weight:600;}
        nav x-anchor.selected:after {font-weight:600; border:.125em var(--x-color-primary) solid;}

        ::slotted(x-tab) {display:none;}
    `,
    state: {
        selectedIndex: 0,
        tabs: []
    },
    template: `
        <style x-html="state.style"></style>
        <nav>
            <x-anchor x-for="(tab,index) in state.tabs" 
                x-text="tab.label" 
                x-attr:icon="tab.icon" 
                x-attr:class="(index == state.selectedIndex ? 'selected' : '')" 
                x-on:click="clicked"></x-anchor>
        </nav>        
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
                let event = args.event;
                let anchors = Array.from(this.shadowRoot.querySelectorAll("nav x-anchor"));
                this.state.selectedIndex = anchors.indexOf(event.target);
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

