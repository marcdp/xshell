
// template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:flex; justify-content:end; padding-bottom:var(--page-padding-bottom); padding-left:var(--page-padding-left); padding-right:var(--page-padding-right); }
    </style>
    <slot></slot>
`;

// class
class XPageFooter extends HTMLElement {
    
    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}


//define web component
customElements.define('x-page-footer', XPageFooter);

//export 
export default XPageFooter;

