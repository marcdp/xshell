import xshell from "x-shell";

// class
class XButton extends HTMLElement  {
    
    //static
    static get observedAttributes() { 
        return ["command"]; 
    }

    //fields
    _command = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `
            <style>
                :host {cursor: pointer; color: blue; text-decoration: underline;}
            </style>
            <slot></slot>`;
        this.shadowRoot.addEventListener("click", (event)=>{
            let page = xshell.getPage(event.target);
            page.onCommand(this.command, this.dataset);
        });
    }

    //props
    get command() {return this._command;}
    set command(value) {this._command = value; }

    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "command") this.command = newValue;
    }

}

//define web component
customElements.define('x-button', XButton);

//export 
export default XButton;

