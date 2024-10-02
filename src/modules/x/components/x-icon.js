import loader from "../../../loader.js";

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
        if (name === "icon") this.icon = newVal;
    }
    connectedCallback() { 
    }
    async render() {
        this._svg = await loader.load("icon", this._icon);
        this.shadowRoot.innerHTML = this._svg ?? "?";
    }

}

export default XIcon;
customElements.define('x-icon', XIcon);