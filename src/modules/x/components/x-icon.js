import loader from "../../../loader.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-icon", {
    style: `
        :host {display:inline-block;}
        :host svg {height:1.25em;width:1.25em; fill:currentcolor; vertical-align:middle;}
        :host(.size-x2) svg {height:2em;width:2em; fill:currentcolor}
    `,
    template: `
        <span x-children="state.svg"></span>
    `,
    state: {
        icon: "",
        svg: null
    },
    //settings: {
    //    observedAttributes: ["icon"]
    //},
    methods: {
        async onCommand(command) {
            if (command == "init") {
                //init
                this.bindEvent(this.state, "change:icon", async () => {
                    if (this.state.icon) {
                        let svgElement = await loader.load("icon:" + this.state.icon);
                        this.state.svg = svgElement.cloneNode(true);  
                    } else {
                        this.state.svg = null;
                    }
                });
            }
        }
    }
});

