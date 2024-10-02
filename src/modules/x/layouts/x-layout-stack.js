let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {display:block;}
        header {background:red; display:flex;}
        header label {flex:1;}
    </style>
    <header>
        <label>header</label>
        <button class="close">
            x
        </button>
        <slot name="toolbar"></slot>
    </header>
    <main>
        <slot></slot>
    </main>
    <footer></footer>
`;

// class
class XLayoutStack extends HTMLElement {

    //fields
    _label = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.shadowRoot.querySelector("header > button.close").addEventListener("click", (event) => {
            var page = this.closest("x-page");
            page.close();
        });
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
export default XLayoutStack;
customElements.define('x-layout-stack', XLayoutStack);