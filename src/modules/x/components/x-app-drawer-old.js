import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-app-drawer-old", {
    style: `
        :host {
            display:block;
            position:relative;
            z-index:20;
        }
        :host > div {
            display:none;
        }
        :host > div.expanded {
            display:block;
            
        } 
        :host > div div.backdrop {
            position:fixed; left:0; top:0; right:0; bottom:0; 
            background: rgba(0,0,0,0);
            transition: background var(--x-transition-duration);
        }
        :host > div.animate div.backdrop {
            background: var(--x-app-drawer-backdrop);
            
        }
        :host > div div.container {
            position:fixed; 
            top:0em; 
            right:0; 
            width: var(--x-app-drawer-width); 
            background: var(--x-app-drawer-background);
            box-sizing: border-box;
            height: 100%; 
            box-shadow: var(--x-app-drawer-shadow);
            border-radius: var(--x-app-drawer-border-radius);
            padding: var(--x-app-drawer-padding);
            overflow-y:auto;
            transform:translateX(110%);
            transition: transform var(--x-transition-duration);
            --desp: 100%;
        }
        :host > div.animate div.container {
            transform:translateX(0%);
        }

        :host(.left) > div div.container {
            left:0;
            right:unset;
            --desp: -100%;
            border-radius: var(--x-app-drawer-border-radius-inverted);
        }

        :host div div.container > x-button.close {position:absolute; top:.75em; right:.8em;}

    `,
    template: `
        <div x-attr:class="state.expanded ? 'expanded' + (state.animate ? ' animate' : '') : ''">
            <div class="backdrop" x-on:click="toggle"></div>
            <div class="container">
                <x-button class="plain close" x-on:click="toggle" icon="x-close"></x-button>
                <slot></slot>
            </div>
        </div>
    `,    
    state: {
        expanded: false,
        animate: false,
    },
    settings: {
        observedAttributes: [],
    },
    methods:{
        toggle() {
            this.onCommand("toggle");
        },
        onStateChanged2(name, oldValue, newValue) {
            if (name == "expanded") {
                if (newValue) {
                    this.render();
                    this.state.animate = true;
                } else {
                    this.state.animate = false;
                }
            }
        },
        onCommand(command) {
            if (command == "load") {
                //load

            } else if (command == "toggle") {
                //toggle
                if (!this.state.expanded) {
                    this.state.expanded = true;
                    this.render();
                    setTimeout(() => {
                        this.state.animate = true;
                    }, 100);                    
                } else {
                    this.state.animate = false;                    
                    this.render();
                    setTimeout(() => {
                        this.state.expanded = false;                    
                    }, 250);
                }
                
            }
        }
    }
});

