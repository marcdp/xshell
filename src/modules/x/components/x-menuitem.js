import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-menuitem", {
    style: `
        :host {display:flex; position:relative; box-sizing:border-box;}
        
        x-anchor {display:flex; flex:1; flex-direction:row; align-items:center; cursor:pointer; line-height:2.25em; border-radius:var(--x-menu-item-border-radius);}
        x-anchor:hover {background:var(--x-background-gray);}
        x-anchor x-icon {color:var(--x-font-color)!important; text-align:center; width:2.5em;}
        x-anchor span.label {color:var(--x-font-color)!important; flex:1; padding-right:1em; text-overflow: ellipsis; white-space: nowrap; overflow:hidden; display:block; width:10em;}
        x-anchor span.label:first-child {padding-left:2.5em;}

        x-anchor[disabled] {pointer-events:none; cursor:default;}
        x-anchor[disabled] x-icon {color:var(--x-font-color-disabled)!important}
        x-anchor[disabled] span {color:var(--x-font-color-disabled)!important}
        
        :host(.tab) {padding-left:0em; padding-right:0em; margin-right:1em; padding-bottom:.25em;}
        :host(.tab) x-anchor:hover {outline-bottom:1px red solid; background:none;}
        :host(.tab) x-anchor span.label {width:unset; padding:0 0 0 0;}
        :host(.tab.selected) {position:relative; font-weight:600;}
        :host(.tab) x-anchor::after {
            content:"";
            border-radius:.1em;
            position:absolute;
            width:100%;
            bottom:0;
            left:0;
        }
        :host(.tab) x-anchor:hover::after {border:.125em var(--x-background-xxx-gray) solid;}
        :host(.tab.selected) x-anchor::after {border:.125em var(--x-color-main) solid;}

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
    `,
    state: {
        icon: "",
        label: "",
        href: "",
        command: "",
        checked: false,
        selected: false,
        disabled: false,
        expanded: false,
        hasChilds:false,
    },
    settings: {
        observedAttributes: ["icon", "label", "href", "command", "disabled", "checked"],
    },
    template: `
        <x-anchor class="menuitem" x-attr:href="state.href" x-attr:command="state.command" x-attr:disabled="state.disabled">
            <x-icon x-if="state.checked" icon="x-check"></x-icon>
            <x-icon x-if="!state.checked && state.icon" x-attr:icon="state.icon"></x-icon>
            <span   x-if="state.label" class="label" x-attr:part="state.icon ? 'label-with-icon' : 'label'">{{ state.label }}</span>
            <x-icon x-if="state.hasChilds" class="has-childs" icon="x-angle-right" part="has-childs"></x-icon>
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
                    this.state.expanded = true;
                    this.onCommand("refresh");    
                });
                this.addEventListener("mouseleave", ()=>{
                    this.state.expanded = false;
                    this.onCommand("refresh");    
                });
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                this.state.hasChilds = (this.firstElementChild != null);

            }
        }
    }

});

