import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-button", {
    style: `
        :host {position:relative; display:inline-flex;}
        :host > div {display:flex; flex:1;  }
        :host div.button {border: .1em var(--x-background-xx-gray) solid; display:inline-block; padding:.5em .75em .5em .75em; border-radius:var(--x-input-border-radius); user-select: none; display:inline-flex; position:relative; 
            align-items:baseline; flex:1;justify-content:center;
        }
        :host div.button:hover {background:var(--x-background-gray); cursor:pointer; }
        :host div.button:active {background: var(--x-background-x-gray);}
        :host div.button > x-icon {font-size:.9em; align-self:center; }
        :host div.button > x-icon[icon] + div {padding-left:.5em;}
        :host div.button > div {display:flex; flex-direction:column; }
        :host div.button > div span.label {white-space:nowrap; }
        :host div.button > div span.message {font-size:var(--x-font-size-small); color:var(--x-text-color-gray); }
        :host div.button[has-more] {border-right:0; border-radius:var(--x-input-border-radius) 0 0 var(--x-input-border-radius);}
        :host div.button[expanded] {background:var(--x-background-gray)!important;}

        :host div.more {border:.1em var(--x-background-xx-gray) solid; border-radius:0 var(--x-input-border-radius) var(--x-input-border-radius) 0; display:flex; align-items:center;}
        :host div.more:hover {background:var(--x-background-gray); cursor:pointer; }
        :host div.more:active {background: var(--x-background-x-gray);}
        :host div.more[expanded] {background:var(--x-background-gray)!important;}

        :host([pressed]) div.button {background:var(--x-background-xxx-gray); border-color:gray}

        :host(.important) div.button {background:var(--x-color-primary); color:var(--x-text-color-inverse); border-color:var(--x-color-primary); }
        :host(.important) div.button x-icon {color:var(--x-text-color-inverse);}
        :host(.important) div.button:hover {background:var(--x-color-primary-light);}
        :host(.important) div.button:active {background:var(--x-color-primary-x-light);}
        
        :host(.plain) div.button {border-color:transparent; }
        :host(.plain) div.button:hover {background: var(--x-background-gray);}
        :host(.plain) div.button:active {background: var(--x-background-x-gray)}
        :host(.plain) div.more {border:none;}

        :host(.no-hover) div.button:hover {background:transparent;}

        ::slotted(x-contextmenu) {left:0; top:calc(100% - .1em);}
    `,
    template: `
        <div>
            <div class="button" tabindex="1" x-attr:expanded="(state.expanded && !state.command ? true : false)" x-on:click="command" x-attr:has-more="(state.hasChilds && state.command ? true : false)" part="button">
                <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
                <div x-if="state.label">
                    <span class="label"   x-html="state.label"></span>
                    <span class="message" x-if="state.message" x-text="state.message"></span>
                </div>
                <x-icon x-if="state.hasChilds && !state.command" icon="x-keyboard-arrow-down"></x-icon>
            </div>
            <div class="more" tabindex="2" x-if="state.hasChilds && state.command" x-on:click="expand" x-attr:expanded="state.expanded">
                <x-icon class="independent" icon="x-keyboard-arrow-down"></x-icon>
            </div>
        </div>
        <div x-if="state.hasChilds" x-show="state.expanded" x-attr:expanded="state.expanded">
            <slot x-on:slotchange="refresh"></slot>
        </div>
    `,
    state: {
        icon: "",
        label: "",
        message: "",
        command: "",
        pressed: false,
        hasChilds:false,
        expanded:false,
    },
    settings: {
        observedAttributes: ["icon", "label", "message", "command", "pressed"]
    },
    methods:{
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.onCommand("refresh");
                this.shadowRoot.addEventListener("focusout", () => {
                    this.onCommand("collapse");
                });

            } else if (command == "command") {
                //command
                let handled = false;
                if (this.state.command) {
                    this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                    handled = true;
                } else if (this.state.hasChilds) {
                    this.state.expanded = !this.state.expanded;
                    handled = true;
                }
                //cancel propagation
                if (handled) {
                    let event = args;
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }

            } else if (command == "expand") {
                //expand
                this.state.expanded = !this.state.expanded;
                this.focus();

            } else if (command == "collapse") {
                //collapse
                this.state.expanded = false;
                
            } else if (command == "refresh") {
                //refresh
                this.state.hasChilds = (this.firstElementChild != null);
                
            }
        }
    }
});

