
// class
class XPageNavigatorPath extends HTMLElement {
    
    //attrs
    static get observedAttributes() { 
        return []; 
    }

    //fields
    _config = {};
    

    //ctor
    constructor() {
        super();
    }

    //props
    get config() {return this._config;}

    //methods
    start(config) {
        this._config = config;
    }
    async showPage({url, type = ""}) {
        if (type == "dialog") {
            //show dialog
            let resolveFunc = null;
            let pageLoader = document.createElement("x-page-loader");
            pageLoader.setAttribute("src", url);
            pageLoader.setAttribute("dialog", "");
            pageLoader.className = "dialog";
            pageLoader.addEventListener("close", (event) => {
                resolveFunc(event.target.result);
                this.removeChild(pageLoader);
            });
            this.appendChild(pageLoader);
            return new Promise((resolve) => {
                resolveFunc = resolve;
             });
        } else if (type == "stack") {
            //show stack 
            //...
        } else {
            //show main page
            //...
        }
    }     

    
}

//define web component
customElements.define('x-page-navigator-path', XPageNavigatorPath);

//export 
export default XPageNavigatorPath;

