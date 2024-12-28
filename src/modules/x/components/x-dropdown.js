import XElement from "../ui/x-element.js";
import utils from "../../../utils.js";
import bus from "../../../bus.js";

// class
export default XElement.define("x-dropdown", {
    style: `
        :host {display:inline-block; position:relative;}
        :host .header {cursor:pointer; }
        :host .header.expanded {color:var(--x-color-primary); }

        :host .body {
            display:none;
            position:absolute;
            z-index:10;
            background:var(--x-dropdown-background);
            box-sizing:border-box;
            border:var(--x-dropdown-border);
            border-radius:var(--x-dropdown-border-radius);
            box-shadow:var(--x-dropdown-shadow);
            min-height:1em;
        }
        :host .body.expanded {
            display:block;
            max-width:95vw;
        }

        /* popover */
        :host(.popover) .body {            
            margin-top:1em;
            margin-left:-2em;
            min-width: clamp(21.15em, 100%, 200%);
        }
        :host(.popover) .body .helper {
            display: inline-block;
            position:absolute;
            z-index:10;
            left:2em;
            top:-.9em;
            width: 0;
            height: 0;
            border-left: .9em solid transparent;
            border-right: .9em solid transparent;
            border-bottom: .9em solid var(--x-dropdown-border-color); 
        }                  
        :host(.popover) .body .helper2 {
            display: inline-block;
            left:2em;
            position:absolute;
            z-index:10;
            top:-.7em;
            width: 0;
            height: 0;
            border-left: .9em solid transparent;
            border-right: .9em solid transparent;
            border-bottom: .9em solid var(--x-dropdown-background); 
        }      

        /* popover left */
        :host(.popover.left) .body {transform:translateX(calc(-100% + 5em));}
        :host(.popover.left) .body .helper {left:unset; right:1em;}
        :host(.popover.left) .body .helper2 {left:unset; right:1em;}
            
        /* input-dropdown */
        :host(.input-dropdown) .header.expanded {
            --x-datafield-border-radius: .75em .75em 0 0;
        }
        :host(.input-dropdown) .body {
            width:100%;
            border-radius:  0 0 var(--x-datafield-border-radius) var(--x-datafield-border-radius);
            border-top:none;
        }
    `,
    template: `
        <div _tabindex="0" x-attr:class="'header ' + (state.expanded ? 'expanded' : '')" x-on:click="click" x-on:focusin="expand">
            <slot></slot>
        </div>
        <div x-attr:class="'body ' + (state.expanded ? 'expanded' : '')" x-on:collapse.stop="collapse">
            <span class="helper"></span>
            <span class="helper2"></span>
            <slot name="dropdown"></slot>
        </div>
    `,
    state:{
        expanded: false, 
        expandedAt: null,
        collapseOnClick: false
    },
    //settings:{
    //    observedAttributes:["collapse-on-click"]
    //},
    methods: {
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.shadowRoot.addEventListener("focusout", (event) => {
                    let relatedTarget = event.relatedTarget
                    if (relatedTarget == null || !utils.isDescendantOfElement(this, relatedTarget)){
                        if (!this.state.collapseOnClick) {
                            this.onCommand("collapse");
                        }
                    }
                });
                this.bindEvent(bus, "navigation-start", () => {
                    if (this.state.expanded) {
                        if (!this.state.collapseOnClick) {
                            this.onCommand("collapse");
                        }
                    }
                });

            } else if (command == "click") {
                //click
                let activeElement = utils.getDeepActiveElement();
                if (utils.isDescendantOfElement(this, activeElement)){
                    this.shadowRoot.querySelector(".header").focus();
                }
                //if collapseOnClick
                if (this.state.collapseOnClick) {
                    if (this.state.expanded) {
                        let diff = performance.now() - this.state.expandedAt;
                        if (diff > 250) this.onCommand("collapse");
                    } else {
                        this.onCommand("expand");
                    }
                }

            } else if (command == "expand") {
                //expand
                if (!this.state.expanded) {
                    this.state.expandedAt = performance.now();
                    this.state.expanded = true;
                }

            } else if (command == "collapse") {
                //collapse
                if (this.state.expanded) {
                    this.state.expanded = false;
                    this.state.expandedAt = null;
                }
            }
        }
    }
});

