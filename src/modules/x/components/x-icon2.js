import loader from "../../../loader.js";
import { LitElement, html, css, svg } from 'https://cdn.jsdelivr.net/npm/lit-element@4.1.0/+esm'
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3.2.0/directives/unsafe-html.js";

class XIcon extends LitElement {

    //static
    static styles = css`
        :host {display:inline-block; }
        :host span {}
        :host svg {height:1.25em; aaspect-ratio:1; width:1.25em;  fill:currentcolor; vertical-align:middle;}
    `;
    static properties = {
        icon: {type: String},
        svg:  {type: String}
    };

    //ctor
    constructor() {
        super();
        this.icon = "";
        this.svg = null;
    }

    // methods
    updated(changedProperties) {
        for(var kkkk of changedProperties){
            if(this.icon) {
                this.loadSvg();
            }
        }
    }
    async loadSvg() {
        this.svg = await loader.load("icon", this.icon);
    }
    render(){    
        return html`
            <span>aa${unsafeHTML(this.svg)}</span>
        `;
    }
}

//define
customElements.define('x-icon2', XIcon);

// export
export default XIcon;
