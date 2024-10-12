import loader from "../../../loader.js";

// CSSStyleSheet
let styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`
    :host {display:inline-block; }
    :host span {}
    :host svg {height:1.25em;width:1.25em; fill:currentcolor; vertical-align:middle;}
`);

// template
let template = document.createElement("template");
template.innerHTML = ``;	

// class
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
        this.shadowRoot.adoptedStyleSheets = [styleSheet];
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
    async render() {
        this._svg = ( this._icon ? await loader.load("icon:" + this._icon) : null);
        this.shadowRoot.replaceChildren();
        if (this._svg) {
            this.shadowRoot.appendChild(this._svg.cloneNode(true), this.shadowRoot);
        }
    }

}

// define
customElements.define('x-icon', XIcon);

// export
export default XIcon;

