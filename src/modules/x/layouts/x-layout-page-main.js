import XPageHeader from "../components/x-page-header.js";
import XPageBody from "../components/x-page-body.js";
import XBreadcrumb from "../components/x-breadcrumb.js";
import XBreadcrumb2 from "../components/x-breadcrumb2.js";

// template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
    </style>
    <main>                
        <x-page-header class="hide-close">
            <x-breadcrumb2 slot="breadcrumb"></x-breadcrumb2>
            <slot name="header"></slot>
        </x-page-header>
        <x-page-body class="">
            <slot></slot>
        </x-page-body>
    </main>
`;

// class
class XLayoutPageMain extends HTMLElement {

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

}

// export
export default XLayoutPageMain;
customElements.define('x-layout-page-main', XLayoutPageMain);