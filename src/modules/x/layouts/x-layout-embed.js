let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
    </style>
    embed:<slot></slot>
`;

class XLayoutEmbded extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    //events 

}

export default XLayoutEmbded;
customElements.define('x-layout-embed', XLayoutEmbded);