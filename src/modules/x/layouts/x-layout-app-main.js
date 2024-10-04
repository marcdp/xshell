import XIcon from "../components/x-icon.js"

// template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
        nav {
            height:3em;
            color:var(--font-color-inverse); 
            background:var(--color-main); 
            display:flex;
            align-items:center;
            position:fixed;
            top:0; left:0; right:0;
        }
        nav x-icon {width:2.5em; text-align:center;}
        div {margin-top:3em;}
    </style>
    <nav>
        <x-icon icon="x-settings"></x-icon>
        <label>This is header</label>
        &nbsp;
        <slot name="toolbar"></slot>
    </nav>
    <div>
        <slot></slot>
    </div>
`;

// class
class XLayoutAppMain extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}

// export
export default XLayoutAppMain;
customElements.define('x-layout-app-main', XLayoutAppMain);