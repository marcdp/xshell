import XPageHeader from "../components/x-page-header.js"
import XPageBody from "../components/x-page-body.js"

// template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
    </style>
    <x-page-header>
        <slot name="header"></slot>    
    </x-page-header>
    <x-page-body>
        <slot></slot>
    </x-page-body>
`;

// class
class XLayoutPageStack extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}

// export
export default XLayoutPageStack;
customElements.define('x-layout-page-stack', XLayoutPageStack);