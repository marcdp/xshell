import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-notice", {
    style: `
        :host {display:block;}

        :host > div {display:flex; border:var(--x-notice-border); border-radius:var(--x-notice-border-radius); margin-top:.5em; margin-bottom:.5em; align-items:start;}

        :host > div div.header {padding:.75em; display:flex; align-items:baseline;}
        :host > div div.header x-icon {width:2.5em; text-align:center;transform:translateY(-.15em);}
        :host > div div.header .label {font-weight:600; margin-right:.5em; color:}
        :host > div div.header .message {flex:1;}
        
        :host > div > .close {margin-right:1em; margin-top:.7em; display:none;}

        :host > div.info {background-color:var(--x-notice-background-info); border:var(--x-notice-border-info);}
        :host > div.info .header x-icon {color:var(--x-notice-color-info);}
        :host > div.warning {background-color:var(--x-notice-background-warning); border:var(--x-notice-border-warning);}
        :host > div.warning .header x-icon {color:var(--x-notice-color-warning);}
        :host > div.error {background-color:var(--x-notice-background-error); border:var(--x-notice-border-error);}
        :host > div.error .header x-icon {color:var(--x-notice-color-error);}
        :host > div.success {background-color:var(--x-notice-background-success); border:var(--x-notice-border-success);}
        :host > div.success .header x-icon {color:var(--x-notice-color-success);}

        :host > div.working {background-color:var(--x-notice-background-working); border:var(--x-notice-border-working);}
        :host > div.working .header x-spinner {color:var(--x-notice-color-working); margin-left:.3em; margin-right:.4em; align-self: self-start;}

        :host(.close) > div > .close {display:block;}

    `,
    template: `
        <div x-if="state.visible" x-attr:class="state.type" >
            <div class="header">
                <x-spinner x-if="state.type=='working'"></x-spinner>
                <x-icon x-else x-attr:icon="'x-' + state.type + ''"></x-icon>
                <div>
                    <div class="label" x-text="state.label"></div>
                    <div class="message" x-text="state.message"></div>
                    <slot></slot>
                </div>
            </div>
            <x-button class="close anchor" x-on:click="close" icon="x-close"></x-button>
        </div>
    `,
    state: {
        type: "info",
        label:"",
        message: "",
        visible: true
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

