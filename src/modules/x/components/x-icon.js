import loader from "../../../loader.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-icon", {
    style: `
        :host {display:inline-block;}
        :host svg {height:1.25em;width:1.25em; fill:currentcolor; vertical-align:middle;}
    `,
    template: `
        <span x-children="state.svg"></span>
    `,
    state: {
        icon: "",
        svg: null
    },
    settings: {
        observedAttributes: ["icon"]
    },
    methods: {
        async onStateChanged(name, oldValue, newValue) {
            if (name == "icon") {
                if (newValue) {
                    this.state.svg = (await loader.load("icon:" + newValue)).cloneNode(true);
                } else {
                    this.state.svg = null;
                }
            }
        }
    }
});

