import i18n from "./../../../i18n.js";

class XI18n extends HTMLElement {

    //static
    static get observedAttributes() { return ["label"]; }

    //fields
    _label = "";
    
    //ctor
    constructor() {
        super();
    }

    //props
    get label() {return this._label}
    set label(value) {
        let changed = (this._label != value);
        this._label = value;
        if (changed) this.render();        
    }

    //events
    async attributeChangedCallback(name, oldVal, newVal) {
        if (name === "label") this.label = newVal;;
    }

    //methods
    render() {
        this.innerHTML = i18n(this._label);
    }

}

export default XI18n;
customElements.define('x-i18n', XI18n);