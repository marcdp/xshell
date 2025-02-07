import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-tabs", {
    style: `
        :host {display:block; margin-bottom:1.5em;}
        
        nav {
            margin-bottom:1.5em; 
            border-bottom:var(--x-accordion-border); 
            display:flex;
            overflow-x:auto;
        }
        
        nav x-anchor {padding-left:1em; padding-right:1em; cursor:pointer; position:relative; line-height:2.5em; display:block; flex:unset; font-size:var(--x-font-size-tab); font-weight:600; white-space:nowrap; }
        
        nav x-anchor:after {content:""; border-radius:.1em; position:absolute; width:calc(100% - .25em); bottom:0; left:0; }

        nav x-anchor:hover {color:var(--x-color-primary);}
        nav x-anchor.selected {font-weight:600; color:var(--x-color-primary);}
        nav x-anchor.selected:after {font-weight:600; border:.125em var(--x-color-primary) solid;}

        ::slotted(x-tab) {display:none;}

        @media only screen and (max-width: 768px) {
            nav x-anchor {
                font-size:var(--x-font-size-text);
                padding-left:.75em; 
                padding-right:.75em;
            }
        }

    `,
    state: {
        selectedIndex: 0,
        selectedHash: "",
        tabs: []
    },
    template: `
        <style x-html="state.style"></style>
        <nav>
            <x-anchor x-for="(tab,index) in state.tabs" 
                x-attr:tabindex="index+1"
                x-text="tab.label" 
                x-attr:icon="tab.icon" 
                x-class:plain="true"
                x-class:selected="index == state.selectedIndex"
                x-on:click="click"
                x-on:keydown.enter="click"
                ></x-anchor>
        </nav>        
        <slot x-on:slotchange="refresh"></slot>
    `, 
    methods:{
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.bindEvent(this.state, "change:selectedHash", (event) => {
                    let hash = event.newValue;
                    let tabs = this.querySelectorAll(":scope > x-tab");
                    let tab = Array.from(tabs).find(tab => tab.getAttribute("hash") == hash);
                    let tabIndex = Array.from(tabs).indexOf(tab);
                    if (tabIndex != -1) this.state.selectedIndex = tabIndex;
                });
                this.bindEvent(this.state, "change:selectedIndex", (event) => {
                    let selectedIndex = event.newValue;
                    let tabs = this.querySelectorAll(":scope > x-tab");
                    let tab = tabs[selectedIndex];
                    if (tab) this.state.selectedHash = tab.hash;
                });
                //hash
                var hash = (this.page.src + "#").split("#")[1];
                if (!hash) hash= this.state.selectedHash;
                if (hash) {
                    this.state.selectedHash = "";
                    this.state.selectedHash = hash;
                }

            } else if (command == "click") {
                //click
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
                        icon: tab.getAttribute("icon") || "",
                        hash: tab.getAttribute("hash") || ""
                    });
                });
                this.state.tabs = tabs;
                this.state.style = `::slotted(x-tab:nth-child(${parseInt(this.state.selectedIndex) + 1})) {display:block;}`;
                //hash
                let tab = tabs[this.state.selectedIndex];
                if (tab && tab.hash) {
                    this.page.replace("#" + tab.hash);
                }
                
            }
        }
    }
});

