import xshell from "x-shell";

// class
class XAnchor  extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["href", "target"]; 
    }

    //fields
    _href = "";
    _target = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<a href='#'><slot></slot></a>`;
    }

    //props
    get href() {return this._href;}
    set href(value) {
        var changed = (this._href != value);
        this._href = value; 
        if (changed) this.render();
    }
    get target() {return this._target;}
    set target(value) {
        var changed = (this._target != value);
        this._target = value; 
        if (changed) this.render();
    }
    


    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "href") this.href = newValue;
        if (name == "target") this.target = newValue;
    }
    render() {
        let page = xshell.getPage(this);
        //compute url relative to base
        let src = page.src;
        if (this.href.startsWith("/")) {
            src = this.href;
        } else {
            if (src.indexOf("?")!=-1) src = src.substring(0, src.indexOf("?"));
            if (src.indexOf("/")!=-1) {
                src = src.substring(0, src.lastIndexOf("/"));
            }
            src += "/" + this.href;
        }
        let href = xshell.getRealUrl(src, page);
        let a = this.shadowRoot.firstChild;
        a.setAttribute("href", href);
        a.setAttribute("target", this.target);
    }


}


//define web component
customElements.define('x-anchor', XAnchor);

//export 
export default XAnchor;

