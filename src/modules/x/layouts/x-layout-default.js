import XBreadcrumb from "../components/x-breadcrumb.js";

let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
        header {background:red; display:flex;}
        header label {flex:1;}
        main  {padding:1em}
    </style>
    <header>
        <label>header</label>
        &nbsp;
        <slot name="toolbar"></slot>
    </header>
    <main>        
        <x-breadcrumb></x-breadcrumb>
        <slot></slot>
    </main>
    <footer></footer>
`;

// class
class XLayoutDefault extends HTMLElement {

    //fields
    _label = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    //events 
    connectedCallback() {
        var page = this.closest("x-page");
        page.addEventListener("load", (event) => {
            this._label = event.target.label;
            this.render();
        });
    }

    //methods
    render() {
        this.shadowRoot.querySelector("header > label").innerHTML = this._label;
    }

}

// export
export default XLayoutDefault;
customElements.define('x-layout-default', XLayoutDefault);