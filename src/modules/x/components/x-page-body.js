
// CSSStyleSheet
let styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`
    :host {display:block; padding:0 var(--page-padding-left) 0 var(--page-padding-right);}
`);

// template
let template = document.createElement("template");
template.innerHTML = ` 
    <slot></slot>
`;

// class
class XPageBody extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.adoptedStyleSheets = [styleSheet];
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
}


//define web component
customElements.define('x-page-body', XPageBody);

//export 
export default XPageBody;

