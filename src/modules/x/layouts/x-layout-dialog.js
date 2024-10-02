import xshell from "../../../x-shell.js";

let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block; max-width:50vw; }
        header {background:red; display:flex; }
        header label {flex:1;}
        main  {padding:1em; 
            max-height:75vh; 
            flex:1;
            overflow-y:auto;
        }
        footer {padding:1em; display:flex; flex-align:end; justify-content:end; }
    </style>
    <header>
        <label>header</label>
        <button class="close">
            x
        </button>
        <slot name="toolbar">
        </slot>
    </header>
    <main>
        <slot></slot>
    </main>
    <footer>
        <slot name="buttons"></slot>
    </footer>
`;

// class
class XLayoutDialog extends HTMLElement {

    //fields
    _label = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.shadowRoot.querySelector("header > button.close").addEventListener("click", (event) => {
            var page = xshell.getPage(event.target);
            page.close();
        });
    }

    //events 
    connectedCallback() {
        xshell.getPage(this).addEventListener("load", (event) => {
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
export default XLayoutDialog;
customElements.define('x-layout-dialog', XLayoutDialog);