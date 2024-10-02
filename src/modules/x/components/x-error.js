
// class
class XError  extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["code", "message", "stacktrace"]; 
    }

    //fields
    _code = 0;
    _message = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    //props
    get code() {return this._code;}
    set code(value) {
        this._code = value; 
        this.render();
    }

    get message() {return this._message;}
    set message(value) {
        this._message = value; 
        this.render();
    }

    get stacktrace() {return this._stacktrace;}
    set stacktrace(value) {
        this._stacktrace = value; 
        this.render();
    }
    

    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "code") this.code = newValue;
        if (name == "message") this.message = newValue;
        if (name == "stacktrace") this.stacktrace = newValue;
    }
    connectedCallback() {
    }
    disconnectedCallback() {
    }
    render() {
        this.shadowRoot.innerHTML = `Error ${this.code}: ${this.message}`;
    }
    

}

//define web component
customElements.define('x-error', XError);

//export 
export default XError;

