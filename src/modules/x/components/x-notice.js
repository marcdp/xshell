import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-notice", {
    style: `
        :host {display:block;}

        :host > div {display:flex; border:var(--x-notice-border); border-radius:var(--x-notice-border-radius); margin-bottom:.65em;}
        :host > div div.header {padding:.45em; display:flex; align-items:center;}
        :host > div div.header x-icon {width:2.5em; text-align:center;}
        :host > div div.header span.label {font-weight:600; margin-right:.5em; color:}
        :host > div div.header span.message {flex:1;}
        :host > div div.buttons {flex:1;}

        :host > div.info {background-color:var(--x-notice-background-info); border:var(--x-notice-border-info);}
        :host > div.info .header x-icon {color:var(--x-notice-color-info);}
        :host > div.warning {background-color:var(--x-notice-background-warning); border:var(--x-notice-border-warning);}
        :host > div.warning .header x-icon {color:var(--x-notice-color-warning);}
        :host > div.error {background-color:var(--x-notice-background-error); border:var(--x-notice-border-error);}
        :host > div.error .header x-icon {color:var(--x-notice-color-error);}
        :host > div.success {background-color:var(--x-notice-background-success); border:var(--x-notice-border-success);}
        :host > div.success .header x-icon {color:var(--x-notice-color-success);}

    `,
    template: `
        <div x-if="state.visible" x-attr:class="state.type" >
            <div class="header">
                <x-icon x-attr:icon="'x-' + state.type + '-fill'"></x-icon>
                <span class="label" x-text="state.label"></span>
                <span class="message" x-text="state.message"></span>
            </div>
            <div class="buttons">
                <slot></slot>
            </div>
            <x-button class="plain no-hover" x-on:click="close" icon="x-close"></x-button>
        </div>
    `,
    state: {
        type: "info",
        label:"",
        message: "",
        visible: true
    },
    settings: {
        observedAttributes: ["type", "label","message"]
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load  

            } else if (command == "close") {
                //close
                this.state.visible = false;
            }
        }
    }
});

