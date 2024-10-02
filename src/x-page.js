import loader from "./loader.js";
import logger from "./logger.js";
import xshell from "./x-shell.js";

// class
class XPage extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["src", "dialog"]; 
    }

    //fields
    _connected = false;
    _src = "";
    _dialog = false;
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
        this._src = value; 
        if (this._src && this._connected) this.loadPage();
    }

    get dialog() {return this._dialog;}
    set dialog(value) {
        this._dialog = value; 
        if (this._src && this._connected) this.loadPage();
    }

    get result() {return this._result;}
    set result(value) {this._result = value;}

    get label() {return this._label;}
    set label(value) {
        let changed = (this._label != value);
        this._label = value; 
        if (changed && this._status == "loaded") this._raiseLabelChangeEvent();
    }

    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "src") this.src = newValue;
        if (name == "dialog") {
            this.dialog = (newValue != null ? true : false);
        }
    }
    connectedCallback() {
        this._connected = true;
        if (this._src && this._connected) this.loadPage();
    }
    disconnectedCallback() {
        this._connected = false;
    }
    close() {
        this._raiseCloseEvent();
    }
    async loadPage() {
        logger.log(`x-page.loadPage('${this.src}')`);
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        this.classList.add("loading");
        //create dialog before fetch
        let dialog = null;
        if (this._dialog) {
            this.replaceChildren();
            dialog = document.createElement("dialog");
            this.appendChild(dialog);
            dialog.showModal();
            dialog.addEventListener('click', (event) => {
                let rect = dialog.getBoundingClientRect();
                let isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
                if (!isInDialog) {
                    event.preventDefault();
                    event.stopPropagation();
                    this._raiseCloseEvent();
                }
            });
        }
        //load
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?")+1) : "");
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
            //class
            let className = "";
            if (searchParams.get("x-class")) className = searchParams.get("x-class");
            if (className) this.classList.add(className);
            //layout
            let layout = xshell.config.ui.layouts.default;
            if (this._dialog) layout = xshell.config.ui.layouts.dialog;
            if (this._dialog && this.classList.contains("stack")) layout = xshell.config.ui.layouts.stack;
            if (searchParams.get("x-layout")) layout = xshell.config.ui.layouts[searchParams.get("x-layout")] || layout;
            await loader.load("layout", layout);
            //title
            let title = doc.title;
            if (searchParams.get("x-title")) title = searchParams.get("x-title");
            //load required components
            let componentNames = [...new Set(Array.from(doc.querySelectorAll('*')).filter(el => el.tagName.includes('-')).map(el => el.tagName.toLowerCase()))];
            await loader.load("component", componentNames);
            //process
            /*
            if (html.indexOf("<html") != -1) {
                //raw
                this._processRawHtml(doc);
                let container = dialog || this;
                if (layout) {
                    let layoutElement = document.createElement(layout);
                    container.appendChild(layoutElement);
                    container = layoutElement;
                }                
                container.innerHTML = doc.body.innerHTML;
                await this._processRawHtml(doc);  
                this.label = title;
            } else {
             */
            //single file page 
            let container = dialog || this;
            container.replaceChildren();
            if (layout) {
                let layoutElement = document.createElement(layout);
                container.appendChild(layoutElement);
                container = layoutElement;
            }
            let script = doc.body.querySelector(":scope > script[type='module']");
            if (!script) script = doc.head.querySelector(":scope > script[type='module']");
            doc.body.childNodes.forEach((node) => {
                container.appendChild(node.cloneNode(true)); 
            });            
            if (script) {
                const moduleText = script.textContent;
                const blob = new Blob([moduleText], { type: "application/javascript" });
                const moduleURL = URL.createObjectURL(blob);
                const module = await import(moduleURL);
                const constructor = module.default;
                const skeleton = new constructor();
                this.onCommand = skeleton.onCommand;
                this.onCommand("load", Object.fromEntries(searchParams));
                URL.revokeObjectURL(moduleURL);
            }            
        }
        //set
        this._status = "loaded"; 
        this.classList.remove("loading");
        //load
        this._raiseLoadChangeEvent();
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
    _raiseLoadChangeEvent() {
        this.dispatchEvent(new CustomEvent("load"));
    }
    _raiseLabelChangeEvent() {
        this.dispatchEvent(new CustomEvent("label-change"));
    }
    _raiseCloseEvent() {
        this.dispatchEvent(new CustomEvent("close", {bubbles: false,cancelable: false,}));
    }    

    // raw html
    async _processRawHtml(doc) {
        let baseUrl = this.src.substring(0, this.src.lastIndexOf("/"));
        doc.querySelectorAll('a[href]').forEach(a => {a.href = this._prefixAnchorUrl(a.getAttribute('href'), baseUrl, "");});
        doc.querySelectorAll('img[src],video[src],audio[src],iframe[src]').forEach(element => {element.src = this._prefixResourceUrl(element.getAttribute('src'), baseUrl, "");});
    }
    _prefixAnchorUrl(url, baseUrl, urlPrefix) {
        if (url.startsWith("#")) return url;
        if (url.indexOf(":") != -1) return url;
        if (!url.startsWith("/")) url = baseUrl + "/" + url;
        url = url.replace("/./", "/");
        return (urlPrefix ?? "") + "#!" + url;
    }
    _prefixResourceUrl(url, baseUrl, urlPrefix) {
        if (url.startsWith("#")) return url;
        if (url.indexOf(":") != -1) return url;
        if (!url.startsWith("/")) url = xshell.config.navigator.base + baseUrl + "/" + url;
        url = url.replace("/./", "/");
        return (urlPrefix ?? "") + url;
    }

}

//define web component
customElements.define('x-page', XPage);

//export 
export default XPage;

