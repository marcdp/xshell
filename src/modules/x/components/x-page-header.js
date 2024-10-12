import xshell from "x-shell";

// CSSStyleSheet
let styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`
    :host {display:flex; padding:var(--page-padding-top) var(--page-padding-left) 1em var(--page-padding-right); flex-wrap:wrap; flex-direction:column;}
    .breadcrumb {width:100%;}
    .breadcrumb:empty {display:none;}

    div {display:flex; align-items:center; flex:1;}
    div > x-icon {display:none;}
    div > x-icon[icon] {display:inline; margin-right:.5em;}
    div label {display:block; font-size:var(--font-size-title); font-weight: 600;}
    div div {flex:1; padding-left:1em; text-align:right; padding-right:1em;}
    div button {border:none; height:2.5em; border-radius:var(--button-border-radius); padding:0; aspect-ratio:1; background:var(--background-page); display:flex; align-items:center; justify-content:center}
    div button:hover {cursor: pointer; background:var(--background-gray);}
    div button:active {background:var(--background-x-gray);}
    div button:hover x-icon {fill:var(--font-color);}
    div button x-icon {}

    :host(.hide-close) div button {display:none;}
`);

// template
let template = document.createElement("template");
template.innerHTML = ` 
    <div class="breadcrumb">
        <slot name="breadcrumb" ></slot>
    </div>

    <div>
        <x-icon></x-icon>
        <label>&nbsp;</label>
        <div>
            <slot></slot>
        </div>
        <button class="close">
            <x-icon icon="x-close"></x-icon>
        </button>
    </div>
`;

// class
class XPageHeader  extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["icon", "label"]; 
    }

    //fields
    _icon = "";
    _label = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.adoptedStyleSheets = [styleSheet];
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.shadowRoot.querySelector("button").addEventListener("click", (event) => {
            xshell.getPage(event.target).close();
        });
    }

    //props
    get icon() {return this._icon;}
    set icon(value) {
        var changed = (this._icon != value);
        this._icon = value; 
        if (changed) this.render();
    }
    get label() {return this._icon;}
    set label(value) {
        var changed = (this._label != value);
        this._label = value; 
        if (changed) this.render();
    }
    


    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "icon") this.icon = newValue;
        if (name == "label") this.label = newValue;
    }
    connectedCallback(){
        xshell.getPage(this).addEventListener("page:load", (event) => {
            this._label = event.target.label;
            this._icon = event.target.icon;
            this.render();
        });
        xshell.getPage(this).addEventListener("page:change", (event) => {
            this._label = event.target.label;
            this._icon = event.target.icon;
            this.render();
        });

    }
    render() {
        this.shadowRoot.querySelector("label").innerHTML = this._label;
        if (this._icon) {
            this.shadowRoot.querySelector("x-icon").setAttribute("icon", this._icon);
        } else {
            this.shadowRoot.querySelector("x-icon").removeAttribute("icon");
        }
        
    }


}


//define web component
customElements.define('x-page-header', XPageHeader);

//export 
export default XPageHeader;

