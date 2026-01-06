import xshell from "xshell";
import XElement from "x-element";

// cache
const svgCache = new Map(); // key: url, value: Promise<SVGElement>

// class
export default XElement.define("x-icon", {
    style: `
        :host {display:inline; }
        :host svg {height:1.25em;width:1.25em; fill:currentcolor; vertical-align:middle; display:inline-block;}
        :host(.size-x2) svg {height:2em;width:2em; fill:currentcolor}
    `,
    template: `
        <span x-if="state.svg" x-children="state.svg"></span>
        <svg x-else></svg>
    `,
    state: {
        icon: "",
        svg: null
    },
    methods: {
        async onCommand(command) {
            if (command == "init") {
                //init
                this.bindEvent(this.state, "change:icon", async () => {
                    if (this.state.icon) {
                        this.state.svg = await xshell.loader.load("icon:" + this.state.icon);
                    } else {
                        this.state.svg = null;
                    }
                });
            }
        }
    }
});

