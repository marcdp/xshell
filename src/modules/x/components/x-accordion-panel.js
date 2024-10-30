import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-accordion-panel", {
    style: `
        :host {display:block;}
        .header {display:flex; height:2.5em; align-items:center; padding:0 .5em 0 1em; cursor:pointer; user-select: none;}
        .header > x-icon {margin-right:.5em; transition: transform var(--x-transition-duration);}
        .header > span {flex:1}
        .header > .toolbar {margin-right:1em; }
        .header[expanded] span {font-weight:600;}
        .header[expanded] x-icon:last-child {transform:rotate(-180deg); }
        
        .body {
            display: grid; 
            grid-template-rows: 0fr;
            transition: var(--x-transition-duration) grid-template-rows ease;
            border-bottom:var(--x-accordion-border); border-bottom-width:1px;
        }
        .body > div {overflow: hidden;}
        .body > div > div {padding:1em;}
        .body[expanded] {grid-template-rows: 1fr;}

        :host(:last-child) .body {border-bottom:none;}
    `,
    template: `
        <div class="header" x-on:click="toggle" x-attr:expanded="state.expanded">
            <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
            <span x-text="state.label"></span>
            <div class="toolbar">
                <slot name="toolbar"></slot>
            </div>
            <x-icon icon="x-keyboard-arrow-down" ></x-icon>
        </div>
        <div class="body" x-attr:expanded="state.expanded">
            <div>
                <div>
                    <slot></slot>
                </div>
            </div>
        </div>
    `,
    state: {
        label:"",
        icon:"",
        expanded: false
    },
    settings: {
        observedAttributes: ["label", "icon", "expanded"],
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "collapse") {
                //collapse
                if (this.state.expanded) {
                    this.onCommand("toggle");
                }

            } else if (command == "toggle") {
                //toggle
                this.state.expanded = !this.state.expanded;
                this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, composed: false}));
            }
        }
    }
});

