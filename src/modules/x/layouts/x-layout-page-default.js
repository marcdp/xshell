// template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
    </style>
    <slot></slot>
`;

// class
class XLayoutPageDefault extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}

// export
export default XLayoutPageDefault;
customElements.define('x-layout-page-default', XLayoutPageDefault);