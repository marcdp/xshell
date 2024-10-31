import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-button", {
    style: `
        :host {position:relative; display:inline-flex;}
        :host > div {display:flex; flex:1;  }
        :host .button {
            border: .1em var(--x-background-xx-gray) solid; 
            padding:.4em .75em .4em .75em; 
            border-radius:var(--x-input-border-radius); 
            user-select: none; 
            display:inline-flex; 
            position:relative; 
            align-items:baseline; flex:1;justify-content:center;
            text-decoration:none;
            color:var(--x-text-color);
        }
        :host .button:hover {background:var(--x-background-gray); cursor:pointer; }
        :host .button:active {background: var(--x-background-x-gray);}
        :host .button > x-icon {font-size:.9em; align-self:center; }
        :host .button > x-icon[icon] + div {padding-left:.5em;}
        :host .button > div {display:flex; flex-direction:column; }
        :host .button > div span.label {white-space:nowrap; }
        :host .button > div span.message {font-size:var(--x-font-size-small); color:var(--x-text-color-gray); }
        :host .button[has-more] {border-right:0; border-radius:var(--x-input-border-radius) 0 0 var(--x-input-border-radius);}
        :host .button[expanded] {background:var(--x-background-gray)!important;}
        :host([disabled]) {pointer-events: none; opacity:.5}
        
        :host div.more {border:.1em var(--x-background-xx-gray) solid; border-radius:0 var(--x-input-border-radius) var(--x-input-border-radius) 0; display:flex; align-items:center;}
        :host div.more:hover {background:var(--x-background-gray); cursor:pointer; }
        :host div.more:active {background: var(--x-background-x-gray);}
        :host div.more[expanded] {background:var(--x-background-gray)!important;}

        :host(.important) .button {background:var(--x-color-primary); color:var(--x-text-color-inverse); border-color:var(--x-color-primary); }
        :host(.important) .button x-icon {color:var(--x-text-color-inverse);}
        :host(.important) .button:hover {background:var(--x-color-primary-light);}
        :host(.important) .button:active {background:var(--x-color-primary-x-light);}
        
        :host(.plain) .button {border-color:transparent; }
        :host(.plain) .button:hover {background: var(--x-background-gray);}
        :host(.plain) .button:active {background: var(--x-background-x-gray)}
        :host(.plain) div.more {border:none;}

        :host(.anchor) .button {border-color:transparent; padding:0;}
        :host(.anchor) .button:hover {background: unset; color:var(--x-color-primary); }
        :host(.anchor) .button:active {background: unset; }
        :host(.anchor) .button[expanded] {background:none!important;}
        :host(.anchor) .button > x-icon[icon] + div {padding-left:.25em}
        :host(.anchor) div.more {border:none;}
        :host(.anchor) div.more[expanded] {background:unset;}
        :host(.anchor) > div {align-items:center; }
        :host(.anchor.plain) .button:hover {color:unset;; }

        :host(.selected) > div a {background:var(--x-background-x-gray);}        

        :host(.no-hover) .button:hover {background:transparent;}
        :host(.short) .button {padding-top:.3em; padding-bottom:.3em;}
        :host(.icon-big) .button {padding:.25em .5em;}
        :host(.icon-big) .button x-icon {font-size:1.1em;}

        ::slotted(x-contextmenu) {left:0; top:calc(100% - .1em);}
        div.right ::slotted(x-contextmenu) {left:unset; right:0; top:calc(100% - .1em);}
    `,
    template: `
        <div>
            <a class="button" tabindex="1" x-attr:href="state.realHref" x-attr:expanded="(state.expanded && !state.command ? true : false)" x-on:click="command" x-attr:has-more="(state.childs && state.command ? true : false)" x-on:keydown.enter="command">
                <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
                <div x-if="state.label">
                    <span class="label"   x-if="state.label" x-html="state.label"></span>
                    <span class="message" x-if="state.message" x-text="state.message"></span>
                </div>
                <x-icon x-if="state.childs && !state.command" icon="x-keyboard-arrow-down"></x-icon>
            </a>
            <div class="more" tabindex="2" x-if="state.childs && state.command" x-on:click="expand" x-attr:expanded="state.expanded" x-on:keydown.enter="expand">
                <x-icon class="independent" icon="x-keyboard-arrow-down"></x-icon>
            </div>
        </div>
        <div x-attr:class="state.childsClass" x-if="state.childs" x-show="state.expanded" x-attr:expanded="state.expanded">
            <slot x-on:slotchange="refresh"></slot>
        </div>
    `,
    state: {
        icon: "",
        label: "",
        message: "",
        command: "",
        href: "",
        realHref: null,
        breadcrumb: false,
        childs:false,
        expanded:false,
        childsClass:"",
    },
    settings: {
        observedAttributes: ["icon", "label", "message", "command", "href", "breadcrumb"]
    },
    methods:{
        onStateChanged(name) {
            if (name == "href") {
                if (this._connected) this.onCommand("refresh");
            }
        },
        onDocumentClick() {
            this.onCommand("collapse");
        },
        onCommand(command, args) {
            if (command == "load") {
                // load
                this.onCommand("refresh");
                this.onDocumentClick = this.onDocumentClick.bind(this);

            } else if (command == "command") {
                // command
                let handled = false;
                if (this.state.command) {
                    this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                    handled = true;
                } else if (this.state.childs) {
                    if (this.state.expanded) {
                        this.onCommand("collapse");
                    } else {
                        this.onCommand("expand");
                    }
                    handled = true;
                }
                //cancel propagation
                if (handled) {
                    let event = args.event;
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }

            } else if (command == "expand") {
                // expand
                this.state.expanded = true;
                // bind event
                document.addEventListener("click", this.onDocumentClick, true);

            } else if (command == "collapse") {
                // collapse
                this.state.expanded = false;
                // unbind event
                document.removeEventListener("click", this.onDocumentClick);
                
            } else if (command == "refresh") {
                // refresh
                this.state.childs = (this.firstElementChild != null);
                // childsClass
                if (this.state.childs) {
                    let rect = this.getBoundingClientRect();
                    if (window.innerWidth - rect.right < 100) {
                        this.state.childsClass = "right";
                    }
                }
                // href
                if (this.state.href) {
                    let xshell = this.xshell;
                    if (xshell) {
                        this.state.realHref = xshell.getRealUrl(this.state.href, this.page, { breadcrumb: this.state.breadcrumb });
                    }
                } else {
                    this.state.realHref = null;
                }
                
            }
        }
    }
});

