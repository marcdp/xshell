import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-menuitem", {
    style: `
        :host {display:flex; position:relative; box-sizing:border-box; flex-direction:column}
        
        /* default */
        :host x-anchor {display:flex; flex:1; flex-direction:row; align-items:center; cursor:pointer; border-radius:var(--x-menuitem-border-radius); user-select: none;}
        :host x-anchor:hover {background:var(--x-background-gray);}
        :host x-anchor x-icon {color:var(--x-text-color)!important; text-align:center;}
        :host x-anchor span.label {color:var(--x-text-color)!important; flex:1;  display:block; padding-top:.5em; padding-bottom:.5em; white-space:nowrap; }
        :host x-anchor span.suffix {color:var(--x-text-color-gray)!important; padding-left:1em;}
        :host x-anchor x-icon.has-childs {width:unset; margin-left:.25em;}
        :host x-anchor x-icon:first-child {}
        :host x-anchor x-icon:first-child:last-child {align-self:flex-end;}
        :host x-anchor x-icon + .label {padding-left:.35em;}
        :host x-anchor[disabled] {pointer-events:none; cursor:default;}
        :host x-anchor[disabled] x-icon {color:var(--x-text-color-disabled)!important;}
        :host x-anchor[disabled] span.label {color:var(--x-text-color-disabled)!important; padding-left:0!important;}
        :host(.selected) x-anchor {background:var(--x-background-x-gray);}
        
        /* dropdown */
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
        suffix: "",
        command: "",
        checked: false,
        disabled: false,
        expanded: false,
        hasChilds:false,
        menuitem: null,
    },
    template: `
        <x-anchor class="menuitem" x-attr:href="state.href" x-attr:command="state.command" x-attr:disabled="state.disabled" x-attr:expanded="state.expanded" >
            <x-icon x-if="state.checked" icon="x-check"></x-icon>
            <x-icon x-if="!state.checked && state.icon" class="icon"x-attr:icon="state.icon"></x-icon>
            <span   x-if="state.label" class="label">{{ state.label }}</span>
            <span   x-if="state.suffix" class="suffix">{{ state.suffix }}</span>
            <x-icon x-if="state.hasChilds" class="has-childs" icon="x-keyboard-arrow-right"></x-icon>
        </x-anchor>
        <div x-if="state.hasChilds" x-show="state.expanded">
            <slot x-on:slotchange="refresh"></slot>
        </div>
    `,
    settings: {
        observedAttributes: ["icon", "label", "suffix", "href", "command", "disabled", "checked"],
    },
    methods: {
        onStateChanged(name, oldValue, newValue) {
            if (name == "menuitem"){
                if (newValue) {
                    this.state.icon = newValue.icon;
                    this.state.label = newValue.label;
                    this.state.href = newValue.href;
                    this.state.command = newValue.command;
                    this.state.checked = newValue.checked;
                    this.state.disabled = newValue.disabled;
                    this.state.suffix = newValue.suffix;
                    if (newValue.children) {
                        this.replaceChildren();
                        for(let child of newValue.children) {
                            let item = document.createElement("x-menuitem");
                            if (child.href) item.setAttribute("href", child.href);
                            item.menuitem = child;
                            this.appendChild(item);
                        }
                    }
                } 
            }
        },
        onCommand(command){
            if (command == "load") {
                //load
                this.addEventListener("mouseenter", ()=>{
                    if (this.classList.contains("childs-inline")) {
                    } else if (this.classList.contains("dropdown-click")) {
                    } else {
                        this.state.expanded = true;
                        this.onCommand("refresh");    
                    }
                });
                this.addEventListener("mouseleave", ()=>{
                    if (this.classList.contains("childs-inline")) {
                    } else if (this.classList.contains("dropdown-click")) {
                    } else {
                        this.state.expanded = false;
                        this.onCommand("refresh");    
                    }
                });
                this.addEventListener("click", (event) => {
                    this.shadowRoot.querySelector("x-anchor").focus();
                    if (this.classList.contains("childs-inline") || this.classList.contains("dropdown-click")) {                        
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

