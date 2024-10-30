import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-popover", {
    style: `
        :host {}
        :host div {
            display:none;
            position:absolute;
            z-index:10;
            border:1px red solid;
            border:var(--x-popover-border);
            border-radius:var(--x-popover-border-radius);
            box-shadow:var(--x-popover-shadow);
            padding:var(--x-popover-padding);
            background:var(--x-popover-background);
            max-width:30em;
        }
        :host div:before {
            content:"";
            position:absolute;
            top:-.6em;
            left:50%;
            transform:translateX(-50%);
            border-left: .6em solid transparent;
            border-right: .6em solid transparent;
            border-bottom: .6em solid #D0D7DE; 
        }
        :host div:after {
            content:"";
            position:absolute;
            top:-.45em;
            left:50%;
            transform:translateX(-50%);
            border-left: .5em solid transparent;
            border-right: .5em solid transparent;
            border-bottom: .5em solid var(--x-popover-background); 
        }
        :host div.expanded {
            display:block;
        }
        
    `,
    template: `
        <style x-html="state.style"></style>
        <div tabindex="0" x-attr:class="(state.expanded ? 'expanded' : '')">
            <slot></slot>
        </div>
    `,
    settings:{
        observedAttributes: ["expanded", "position"]
    },
    state: {
        style: "",
        expanded: false
    },
    methods:{
        show() {
            this.state.expanded = !this.state.expanded;
        },
        onStateChanged(name, oldValue, newValue) {
            if (name == "expanded") {
                if (newValue) {
                    this.render();
                    this.onCommand("refresh");
                }
            }
        },
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.shadowRoot.addEventListener("focusout", () => {
                    this.state.expanded = false;
                });
            } else if (command == "refresh") {
                //refresh
                let div = this.shadowRoot.querySelector("div");
                let target = this.previousElementSibling;
                let rectDiv = div.getBoundingClientRect();
                let rectTarget = target.getBoundingClientRect();
                let margin = 10;
                let style = `top:${this.offsetTop + rectTarget.height + margin}px; left:${target.offsetLeft - rectDiv.width/2 + rectTarget.width/2}px;`;
                this.state.style = "div {" + style + "}";
                div.focus();
    
            }
        }

    }
});

