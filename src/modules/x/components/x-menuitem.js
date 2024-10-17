import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-menuitem", {
    style: `
        :host {display:flex; position:relative; box-sizing:border-box; flex-direction:column}
        
        :host x-anchor {display:flex; flex:1; flex-direction:row; align-items:center; cursor:pointer; border-radius:var(--x-menu-item-border-radius); user-select: none;}
        :host x-anchor:hover {background:var(--x-background-gray);}
        :host x-anchor x-icon {color:var(--x-text-color)!important; text-align:center; width:2.5em; line-height:2em;}
        :host x-anchor span.label {color:var(--x-text-color)!important; flex:1;  display:block; padding-top:.5em; padding-bottom:.5em;}
        :host x-anchor span.label:first-child {padding-left:2.5em;}
        :host x-anchor span.label:last-child {padding-right:1em; }
        :host x-anchor span.suffix {color:var(--x-text-color-gray)!important; padding-left:1em; padding-right:1em;}

        :host x-anchor[disabled] {pointer-events:none; cursor:default;}
        :host x-anchor[disabled] x-icon {color:var(--x-text-color-disabled)!important;}
        :host x-anchor[disabled] span.label {color:var(--x-text-color-disabled)!important; padding-left:0!important;}
        
        :host(.tab) {padding-left:0em; padding-right:0em; margin-right:1em; padding-bottom:.25em;}
        :host(.tab) x-anchor:hover {outline-bottom:1px red solid; background:none;}
        :host(.tab) x-anchor span.label {width:unset; padding:0 0 0 0; line-height:2em}
        :host(.tab.selected) {position:relative; font-weight:600;}
        :host(.tab) x-anchor::after {content:""; border-radius:.1em; position:absolute; width:100%; bottom:0; left:0;}
        :host(.tab) x-anchor:hover::after {border:.125em var(--x-background-xxx-gray) solid;}
        :host(.tab.selected) x-anchor::after {border:.125em var(--x-color-primary) solid;}

        :host(.plain) {}
        :host(.plain) x-anchor span.label:first-child {padding-left:.5em;}

        div {
            width: var(--x-menu-width);
            position:absolute; 
            display:flex; 
            flex-direction:column; 
            z-index:10; 
            background:var(--x-background-page);

            border-radius:var(--x-menu-border-radius); 
            padding:.25em; 
            box-shadow:var(--x-menu-shadow); 
            border:var(--x-menu-border);
            
            left:100%;
            margin-top:0 em;
        }

        :host(.childs-inline) x-anchor .has-childs {transform:rotate(90deg); transition: transform var(--x-transition-duration);}
        :host(.childs-inline) x-anchor[expanded] .has-childs {transform:rotate(-90deg)}
        :host(.childs-inline) div {
            position:unset;
            border:none;
            background:none;
            padding:0;
            width:unset;
            box-shadow:none;
            margin-left:2.5em;
        }
        :host(.childs-inline.plain) div {
            margin-left:1.5em;
        }
    `,
    state: {
        icon: "",
        label: "",
        href: "",
        mode: "",
        suffix: "",
        command: "",
        checked: false,
        selected: false,
        disabled: false,
        expanded: false,
        hasChilds:false,
    },
    settings: {
        observedAttributes: ["icon", "label", "suffix", "href", "command", "disabled", "checked", "mode"],
    },
    template: `
        <x-anchor class="menuitem" x-attr:href="state.href" x-attr:command="state.command" x-attr:disabled="state.disabled" x-attr:expanded="state.expanded">
            <x-icon x-if="state.checked" icon="x-check"></x-icon>
            <x-icon x-if="!state.checked && state.icon" class="icon"x-attr:icon="state.icon"></x-icon>
            <span   x-if="state.label" class="label" x-attr:part="state.icon ? 'label-with-icon' : 'label'">{{ state.label }}</span>
            <span   x-if="state.suffix" class="suffix">{{ state.suffix }}</span>
            <x-icon x-if="state.hasChilds" class="has-childs" icon="x-keyboard-arrow-right" part="has-childs"></x-icon>
        </x-anchor>
        <div x-if="state.hasChilds" x-show="state.expanded" part="div">
            <slot x-on:slotchange="refresh"></slot>
        </div>
    `,
    methods: {
        onCommand(command){
            if (command == "load") {
                //load
                this.addEventListener("mouseenter", ()=>{
                    if (!this.classList.contains("childs-inline")) {
                        this.state.expanded = true;
                        this.onCommand("refresh");    
                    }
                });
                this.addEventListener("mouseleave", ()=>{
                    if (!this.classList.contains("childs-inline")) {
                        this.state.expanded = false;
                        this.onCommand("refresh");    
                    }
                });
                this.addEventListener("click", (event) => {
                    if (this.classList.contains("childs-inline")) {
                        this.state.expanded = !this.state.expanded;
                        this.onCommand("refresh");    
                        event.preventDefault();
                        event.stopPropagation();
                    }
                });
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                this.state.hasChilds = (this.firstElementChild != null);

            }
        }
    }

});

