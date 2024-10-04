import loader from "../../../loader.js";

let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:inline-block; }
        :host span {}
        :host svg {height:1.25em; aaspect-ratio:1; width:1.25em;  fill:currentcolor; vertical-align:middle;}
    </style>
    <span></span>
`;	

class XIcon extends HTMLElement {

    //static
    static get observedAttributes() { return ["icon"]; }

    //fields
    _icon = "";
    _svg = null;
        
    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    //props
    get icon() { return this.state.icon; }
    set icon(value) {
        let changed = (this._icon != value);
        this._icon = value;
        if (changed) this.render();        
    }

    //events
    async attributeChangedCallback(name, oldVal, newVal) {
        if (name === "icon") this.icon = (newVal == "" ? null : newVal);
    }
    connectedCallback() { 
    }
    async render() {
        this._svg = await loader.load("icon", this._icon);
        this.shadowRoot.lastElementChild.innerHTML = (this._icon ? this._svg ?? "?" : "");
    }

}

export default XIcon;
customElements.define('x-icon', XIcon);