import {resolver} from "xshell";
import XElement from "x-element";

// cache
const svgCache = new Map(); // key: url, value: Promise<SVGElement>

// class
export default XElement.define("x-icon2", {
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
                        let svg = await this._loadSVG(this.state.icon);
                        this.state.svg = svg.cloneNode(true);
                    } else {
                        this.state.svg = null;
                    }
                });
            }
        },
        async _loadSVG(name) {
            if (svgCache.has(name)) {
                return svgCache.get(name);
            }
            //resolve
            let url = resolver.resolve("icon:" + name);
            //url = "http://127.0.0.1:8080/src/x/icons/file.svg";
            // promise
            const promise = (async () => {
                const res = await fetch(url);
                const text = await res.text();
                const doc = new DOMParser().parseFromString(text, "image/svg+xml");
                const el = doc.documentElement;
                // Ensure it's an <svg>
                if (el.nodeName.toLowerCase() !== "svg") {
                    throw new Error(`URL ${url} did not return a valid SVG`);
                }
                return el;
            })();
            // set cache
            svgCache.set(name, promise);
            // return
            return  promise;
        }
    }
});

