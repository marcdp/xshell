import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-page-header", {
    style: `
        :host {display:flex; padding:var(--x-page-padding-top) var(--x-page-padding-left) 1em var(--x-page-padding-right); flex-wrap:wrap; flex-direction:column;}
        .breadcrumb {width:100%;}
        .breadcrumb:empty {display:none;}

        div {display:flex; align-items:center; flex:1;}
        div > x-icon {display:none;}
        div > x-icon[icon] {display:inline; margin-right:.5em;}
        div label {display:block; font-size:var(--x-font-size-title); font-weight: 600;}
        div div {flex:1; padding-left:1em; text-align:right; padding-right:1em;}
        div button {border:none; height:2.5em; border-radius:var(--x-button-border-radius); padding:0; aspect-ratio:1; background:var(--x-background-page); display:flex; align-items:center; justify-content:center}
        div button:hover {cursor: pointer; background:var(--x-background-gray);}
        div button:active {background:var(--x-background-x-gray);}
        div button:hover x-icon {fill:var(--x-text-color);}
        div button x-icon {}

        :host(.hide-close) div button {display:none;}
        @media only screen and (max-width: 768px) {
            div label {font-size:var(--x-font-size-subtitle);}
        }
    `,
    template: `
        <div class="breadcrumb">
            <slot name="breadcrumb" ></slot>
        </div>

        <div>
            <x-icon x-show="state.icon" x-attr:icon="state.icon"></x-icon>
            <label>{{ state.label }}</label>
            <div>
                <slot></slot>
            </div>
            <button class="close" x-on:click="close">
                <x-icon icon="x-close"></x-icon>
            </button>
        </div>
    `,
    state: {
        icon:"",
        label:""
    },
    settings: {
        observedAttributes: ["icon", "label"],
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load
                this.page.addEventListener("page:load", () => { this.onCommand("refresh"); });
                this.page.addEventListener("page:change", () => { this.onCommand("refresh"); });

            } else if (command == "refresh") {
                //refresh
                let page = this.page;
                if (page) {
                    this.state.label = this.page.label;
                    this.state.icon = this.page.icon;
                }

            } else if (command == "close") {
                //close
                this.page.close();
            }
        }
    }
});
