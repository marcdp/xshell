import xshell from "x-shell";

//template
let template = document.createElement("template");
template.innerHTML = ` 
    <style>
        :host {border: 1px var(--background-x-gray) solid; display:inline-block; padding:.5em .8em .5em .8em; border-radius:var(--input-border-radius); user-select: none; display:inline-flex; align-items:center;}
        :host(:hover) {background:var(--background-gray); cursor:pointer; border-color: var(--background-x-gray); }
        :host(:active) {background:var(--background-x-gray);}
        :host x-icon {font-size:.9em; }
        :host x-icon[icon] {margin-right:.45em;}

        :host([appearance='accent']) {background:var(--color-main); color:var(--font-color-inverse); border:none;}
        :host([appearance='accent']) x-icon {fill:red; color:var(--font-color-inverse);}
        :host([appearance='accent']:hover) {background:var(--color-main-light);}
        :host([appearance='accent']:active) {background:var(--color-main-x-light);}

        :host([appearance='lightweight']) {border:none;}
        :host([appearance='lightweight']:hover) {}
        :host([appearance='lightweight']:active) {}

        :host([appearance='outline']) {border-color: var(--background-xx-gray); }
        :host([appearance='outline']:hover) {background:var(--background); border-color:var(--background-xxx-gray);}
        :host([appearance='outline']:active) {border-color: var(--background-xx-gray);}

    </style>
    <x-icon></x-icon>
    <span><slot></slot></span>
`;

// class
class XButton extends HTMLElement  {
    
    //static
    static get observedAttributes() { 
        return ["command", "icon"]; 
    }

    //fields
    _command = "";
    _icon = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.addEventListener("click", (event)=>{
            let page = xshell.getPage(this);
            page.onCommand(this.command, this.dataset);
            event.preventDefault();
            event.stopPropagation();
            return false;
        }, true);
    }

    //props
    get command() {return this._command;}
    set command(value) {this._command = value; }
    get icon() {return this._icon;}
    set icon(value) {this._icon = value; this._render();}

    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "command") this.command = newValue;
        if (name == "icon") this.icon = newValue;
    }
    _render() {
        this.shadowRoot.querySelector("x-icon").setAttribute("icon", this._icon);

    }

}

//define web component
customElements.define('x-button', XButton);

//export 
export default XButton;

