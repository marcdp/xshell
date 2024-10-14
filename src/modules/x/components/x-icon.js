import loader from "../../../loader.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-icon", {
    style: `
        :host {display:inline-block;}
        :host svg {height:1.25em;width:1.25em; fill:currentcolor; vertical-align:middle;}
    `,
    template: ``,
    state: {
        icon: ""
    },
    settings: {
        observedAttributes: ["icon"]
    },
    methods: {
        async onStateChanged(name, oldValue, newValue) {
            if (name == "icon") {
                if (newValue) {
                    let svg = await loader.load("icon:" + newValue);
                    this.shadowRoot.replaceChildren();
                    this.shadowRoot.appendChild(svg.cloneNode(true), this.shadowRoot);
                } else {
                    this.shadowRoot.replaceChildren();
                }
            }
        },
        render() {
        }
    }
});

