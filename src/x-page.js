import loader from "./loader.js";
import logger from "./logger.js";
import xshell from "./x-shell.js";

// class
class XPage extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["src", "type"]; 
    }

    //fields
    _connected = false;
    _breadcrumb = [];
    _src = "";
    _type = "";
    _status = "";
    _result = null;
    _label = "";
    _icon = "";

    //ctor
    constructor() {
        super();
    }

    //props
    get src() {return this._src;}
    set src(value) {
        let changed = (this._src != value);
        this._src = value; 
        if (changed){
            this._breadcrumb = [];
            this._result = null;
            if (this._src && this._connected) this.loadPage();
        }
    }

    get breadcrumb() {return this._breadcrumb;}
    set breadcrumb(value) {this._breadcrumb = value; }

    get result() {return this._result;}
    set result(value) {this._result = value;}

    get type() {return this._type;}
    set type(value) {this._type = value;}

    get label() {return this._label;}
    set label(value) {
        let changed = (this._label != value);
        this._label = value; 
        if (changed) this._raisePageChangeEvent();
    }

    get icon() {return this._icon;}
    set icon(value) {
        let changed = (this._icon != value);
        this._icon = value; 
        if (changed) this._raisePageChangeEvent();
    }

    //events
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "src") this.src = newValue;
        if (name == "type") this.type = newValue;
    }
    connectedCallback() {
        this._connected = true;
        if (this._src && this._connected) this.loadPage();
    }
    disconnectedCallback() {
        this._connected = false;
    }

    //methods
    async showPage({url}) {
        await xshell.showPage({url, sender:this});
    }
    async showPageStack({url}) {
        await xshell.showPageStack({url, sender:this});
    }
    async showPageDialog({url}) {
        return xshell.showPageDialog({url, sender:this});
    }
    close() {
        this._raisePageCloseEvent();
    }
    async loadPage() {
        logger.log(`x-page.loadPage('${this.src}')`);
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        this.classList.add("loading");
        //search
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?")+1) : "");
        //class
        let className = "";
        if (searchParams.get("x-class")) className = searchParams.get("x-class");
        if (className) for(let classNamePart of className.split(",")) this.classList.add(classNamePart);
        //create dialog before fetch
        let dialog = null;
        if (this._type == "dialog" || this._type == "stack") {
            if (this.firstChild && this.firstChild.localName == "dialog") {
                dialog = this.firstChild;
            } else {
                dialog = document.createElement("dialog");
                this.appendChild(dialog);
                dialog.showModal();
                dialog.addEventListener('click', (event) => {
                    let rect = dialog.getBoundingClientRect();
                    let isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
                    if (!isInDialog) {
                        event.preventDefault();
                        event.stopPropagation();
                        this._raisePageCloseEvent();
                    }
                });
            }
        }
        //load html page
        let src = this.src;        
        if (!src.startsWith("/")) src = loader.resolveUrl("page", src.split("?")[0]);
        if (src.indexOf("://") == -1) src = xshell.config.navigator.base + src;
        let response = await fetch(src);
        let contentType = response.headers.get("Content-Type");
        let content = await response.text();   
        if (!response.ok) {
            //error
            this._status = "error"; 
            this.classList.remove("loading");
            this._loadError(response.status, response.statusText);
            return;
        } else if (contentType.indexOf("text/html")!=-1) {
            //html page
            let html = content;
            let parser = new DOMParser();
            let doc = parser.parseFromString(html, "text/html");
            //layout
            let layout = xshell.config.ui.layouts.page.default;
            if (this._type) layout = xshell.config.ui.layouts.page[this._type];
            doc.head.querySelectorAll("meta[name='x-page:layout']").forEach((sender)=>{layout = xshell.config.ui.layouts.page[sender.content];});
            if (searchParams.get("x-layout")) layout = xshell.config.ui.layouts.page[searchParams.get("x-layout")] || layout;
            await loader.load("layout", layout);
            //label
            let label = doc.title;
            doc.head.querySelectorAll("meta[name='x-page:label']").forEach((sender)=>{label = sender.content;});
            if (searchParams.get("x-label")) label = searchParams.get("x-label");
            //icon
            let icon = "";
            doc.head.querySelectorAll("meta[name='x-page:icon']").forEach((sender)=>{icon = sender.content;});
            if (searchParams.get("x-icon")) icon = searchParams.get("x-icon");
            //breadcrumb
            let breadcrumb = [];
            if (searchParams.get("x-breadcrumb")) breadcrumb = JSON.parse(atob(searchParams.get("x-breadcrumb").replace(/_/g,"/").replace(/-/g,"+")));
            //load required components
            let componentNames = [...new Set(Array.from(doc.querySelectorAll('*')).filter(el => el.tagName.includes('-')).map(el => el.tagName.toLowerCase()))];
            await loader.load("component", componentNames);          
            //single file page 
            let container = dialog || this;
            container.replaceChildren();
            if (layout) {
                let layoutElement = document.createElement(layout);
                container.appendChild(layoutElement);
                container = layoutElement;
            }
            //get script
            let script = doc.body.querySelector(":scope > script[type='module']");
            if (!script) script = doc.head.querySelector(":scope > script[type='module']");
            doc.body.childNodes.forEach((node) => {
                container.appendChild(node.cloneNode(true)); 
            });            
            //clone script
            if (script) {
                const moduleText = script.textContent;
                const blob = new Blob([moduleText], { type: "application/javascript" });
                const moduleURL = URL.createObjectURL(blob);
                const module = await import(moduleURL);
                const constructor = module.default;
                const instance = new constructor();
                this.onCommand = instance.onCommand;
                let loadArgs = {};
                for(const [key, value] of searchParams.entries()){
                    if (!key.startsWith("x-")) {
                        loadArgs[key] = value;
                    }
                }
                this.onCommand("load", loadArgs);
                URL.revokeObjectURL(moduleURL);
            }            
            if(label) this.label = label;
            if(icon) this.icon = icon;
            if (breadcrumb) this.breadcrumb = breadcrumb;
        }
        //set
        this._status = "loaded"; 
        this.classList.remove("loading");
        //load
        this._raisePageLoadEvent();
    }    


    //private methods
    async _loadError(code, message, stacktrace) {
        var name = xshell.config.ui.errors[code];
        if (!name) name = xshell.config.ui.errors.default;
        await loader.load("component", name);
        let error = document.createElement(name);
        error.setAttribute("code", code);
        error.setAttribute("message", message);
        error.setAttribute("stacktrace", stacktrace);
        this.appendChild(error);
    }
    _raisePageLoadEvent() {
        this.dispatchEvent(new CustomEvent("page:load"));
    }
    _raisePageChangeEvent() {
        this.dispatchEvent(new CustomEvent("page:change"));
    }
    _raisePageCloseEvent() {
        this.dispatchEvent(new CustomEvent("page:close"));
    }    

}

//define web component
customElements.define('x-page', XPage);

//export 
export default XPage;

