import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-button", {
    style: `
        :host {position:relative; display:inline-block;}
        :host > div {display:flex; }
        :host div.button {border: .1em var(--x-background-xx-gray) solid; display:inline-block; padding:.5em .75em .5em .75em; border-radius:var(--x-input-border-radius); user-select: none; display:inline-flex; position:relative; }
        :host div.button:hover {background:var(--x-background-gray); cursor:pointer; }
        :host div.button:active {background: var(--x-background-x-gray);}
        :host div.button > x-icon {font-size:.9em; }
        :host div.button > x-icon[icon] + div {padding-left:.5em;}
        :host div.button > div {display:flex; flex-direction:column; }
        :host div.button > div span.label {}
        :host div.button > div span.message {font-size:var(--x-font-size-small); color:var(--x-font-color-gray); }
        :host div.button[has-more] {border-right:0; border-radius:var(--x-input-border-radius) 0 0 var(--x-input-border-radius);}
        :host div.button[expanded] {background:var(--x-background-gray)!important;}

        :host div.more {border:.1em var(--x-background-xx-gray) solid; border-radius:0 var(--x-input-border-radius) var(--x-input-border-radius) 0; display:flex; align-items:center;}
        :host div.more:hover {background:var(--x-background-gray); cursor:pointer; }
        :host div.more:active {background: var(--x-background-x-gray);}
        :host div.more[expanded] {background:var(--x-background-gray)!important;}

        :host([pressed]) div.button {background:var(--x-background-xxx-gray); border-color:gray}

        :host(.important) div.button {background:var(--x-color-main); color:var(--x-font-color-inverse); border:none; }
        :host(.important) div.button x-icon {fill:red; color:var(--x-font-color-inverse);}
        :host(.important) div.button:hover {background:var(--x-color-main-light);}
        :host(.important) div.button:active {background:var(--x-color-main-x-light);}

        :host(.plain) div.button {border:none; }
        :host(.plain) div.button:hover {background: var(--x-background-gray);}
        :host(.plain) div.button:active {background: var(--x-background-x-gray)}
        :host(.plain) div.more {border:none;}

        ::slotted(x-contextmenu) {left:0; top:calc(100% - .1em);}
    `,
    template: `
        <div>
            <div class="button" tabindex="1" x-attr:expanded="state.expanded && !state.command" x-on:click="command" x-attr:has-more="state.hasChilds && state.command">
                <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
                <div x-if="state.label">
                    <span class="label"   x-html="state.label"></span>
                    <span class="message" x-if="state.message" x-text="state.message"></span>
                </div>
                <x-icon x-if="state.hasChilds && !state.command" icon="x-keyboard-arrow-down"></x-icon>
            </div>
            <div class="more" x-if="state.hasChilds && state.command" x-on:click="expand" x-attr:expanded="state.expanded">
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
        onCommand(command) {
            if (command == "load") {
                //load
                /*
                this.addEventListener("click", (event) => {
                    //raise command event
                    if (this.state.command) {
                        this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                    } else {
                        this.state.expanded = !this.state.expanded;
                    }
                    //cancel event
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }, true);*/
                //refresh
                this.onCommand("refresh");

            } else if (command == "command") {
                //command
                if (this.state.command) {
                    this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                } else {
                    this.state.expanded = !this.state.expanded;
                }

            } else if (command == "expand") {
                //expand
                this.state.expanded = !this.state.expanded;

            } else if (command == "refresh") {
                //refresh
                this.state.hasChilds = (this.firstElementChild != null);
                
            }
        }
    }
});

