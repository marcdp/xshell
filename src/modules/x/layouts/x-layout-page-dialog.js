import xshell from "../../../x-shell.js";
import XPageHeader from "../components/x-page-header.js"
import XPageBody from "../components/x-page-body.js"
import XPageFooter from "../components/x-page-footer.js"

//template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {
            display:block; 
            max-width:75vw; 
        }
        x-page-body {
            max-height:calc(100vh - 15em); 
            overflow-y:auto;
        }
    </style>
    <x-page-header>
        <slot name="header"></slot>    
    </x-page-header>
    <x-page-body>
        <slot></slot>
    </x-page-body>    
    <x-page-footer>
        <slot name="footer"></slot>
    </x-page-footer>
`;

// class
class XLayoutPageDialog extends HTMLElement {

    //fields
    _label = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}

// export
export default XLayoutPageDialog;
customElements.define('x-layout-page-dialog', XLayoutPageDialog);