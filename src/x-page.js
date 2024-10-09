import loader from "./loader.js";
import logger from "./logger.js";
import xshell from "./x-shell.js";
import XTemplate from "./x-template.js";


// class
class XPageInstance {

    //fields
    _page = null;
    _container = null;
    _state = null;
    _xtemplate = null;
    _xtemplateInstance = null;

    //ctor
    constructor(page, container, template, styles) {
        this._page = page;
        this._container = container;
        this._xtemplate = new XTemplate({
            template: template,
            styleSheets: styles
        });
        
    }

    //properties
    get dependencies() {return this._xtemplate.dependencies;}
    get src() {return this._page.src;}
    get label() {return this._page.label;}
    set label(value) {this._page.label = value;}
    get icon() {return this._page.icon;}
    set icon(value) {this._page.icon = value;}
    get result() {return this._page.result;}
    set result(value) {this._page.result = value;}

    get state() {return this._state;}
    set state(value) {this._state = value;}

    //methods
    load(args) {       
        //state
        let self = this;
        let rawState = this.state || {};
        delete this.state;
        this.state = new Proxy(rawState, {
            set(target, prop, newValue) {
                let oldValue = target[prop];
                target[prop] = newValue;
                self.stateChanged(prop, oldValue, newValue);
                self.render();
                return true;
            }
        });
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance(rawState, (aa,bb)=>{
            debugger;
        }, this._container);
        //load
        this.onCommand("load", args);
        this.render();
    }
    onCommand(command, args) {
    }
    unload() {
    }
    showPage(args) {
        return this._page.showPage(args);
    }
    showPageStack(args) {
        return this._page.showPageStack(args);
    }
    showPageDialog(args) {
        return this._page.showPageDialog(args);
    }
    close(result) {
        return this._page.close(result);
    }
    stateChanged(prop, oldvalue, newValue) {
    }
    invalidate() {
        //TODO: timeout
        //...        
    }
    render() {
        this._xtemplateInstance.render();
    }   
}


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
    _instance = null;

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
    onCommand(command, args) {  
        if (this._instance) this._instance.onCommand(command, args);
    }
    async showPage({url}) {
        await xshell.showPage({url, sender:this});
    }
    async showPageStack({url}) {
        await xshell.showPageStack({url, sender:this});
    }
    async showPageDialog({url}) {
        return xshell.showPageDialog({url, sender:this});
    }
    close(result) {
        if (result != undefined) this._result = result;
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
                dialog.addEventListener('click', (event) => {
                    let rect = dialog.getBoundingClientRect();
                    let isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
                    if (!isInDialog) {
                        event.preventDefault();
                        event.stopPropagation();
                        this._raisePageCloseEvent();
                    }
                });
                this.appendChild(dialog);
                dialog.showModal();
            }
        }
        //load html page
        let src = this.src;        
        if (src.indexOf("://") == -1) src = xshell.config.navigator.base + src;
        let response = await fetch(src);
        let contentType = response.headers.get("Content-Type");
        let content = await response.text();   
        if (!response.ok) {
            //error
            this._status = "error"; 
            this.classList.remove("loading");
            this._showError(response.status, response.statusText);
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
            await loader.load("layout:" + layout);
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
            //handler
            let handler = "";
            doc.head.querySelectorAll("meta[name='x-page:handler']").forEach((sender) => { handler = sender.content; });
            //container
            let container = dialog || this;
            container.replaceChildren();
            if (layout) {
                let layoutElement = document.createElement(layout);
                container.appendChild(layoutElement);
                container = layoutElement;
            }
            //init
            if (handler == "") {
                //init page
                doc.head.childNodes.forEach((node) => {
                    container.appendChild(node.cloneNode(true)); 
                });
                doc.body.childNodes.forEach((node) => {
                    container.appendChild(node.cloneNode(true)); 
                });
                //activate scripts
                container.querySelectorAll("script").forEach((script) => {
                    let newScript = document.createElement("script");
                    for(var i = 0; i < script.attributes.length; i++) {
                        newScript.setAttribute(script.attributes[i].name, script.attributes[i].value);
                    }
                    newScript.textContent = script.textContent;
                    if (container.contains(script)) {
                        script.parentNode.replaceChild(newScript, script);
                    } else {
                        container.appendChild(newScript);
                    }
                });

            } else if (handler == "x") {
                //init page
                //styles
                let styles = [];
                doc.body.querySelectorAll(":scope > style").forEach((style) => {styles.push(style);});
                doc.head.querySelectorAll(":scope > style").forEach((style) => {styles.push(style);});
                //template
                let template = doc.body.querySelector(":scope > template") || doc.head.querySelector(":scope > template");
                //script
                let script = doc.body.querySelector(":scope > script[type='module']") || doc.head.querySelector(":scope > script[type='module']");
                let moduleText = script.textContent;
                let baseUrl = src.substring(0, src.lastIndexOf("/"));
                if (moduleText.indexOf("import ") != -1) {
                    //replace each relative URL with an absolute URL
                    const importRegex = /(import\s+.*?['"])(\.\/|\.\.\/|\/)([^'"]+)(['"])/g;
                    moduleText = moduleText.replace(importRegex, (match, start, pathType, urlPath, end) => {
                        let absoluteUrl;
                        if (pathType === '/') {
                            const base = new URL(baseUrl);
                            absoluteUrl = `${base.origin}${pathType}${urlPath}`;
                        } else {
                            absoluteUrl = new URL(pathType + urlPath, baseUrl).href;
                        }
                        return `${start}${absoluteUrl}${end}`;
                    });
                }
                //load from blob
                const blob = new Blob([moduleText], { type: "application/javascript" });
                const moduleURL = URL.createObjectURL(blob);
                const module = await import(moduleURL);
                URL.revokeObjectURL(moduleURL);
                //create instance
                this._instance = new module.default(this, container, template.innerHTML, styles);
                //load dependencies
                await loader.load("component", this._instance.dependencies);
                //load instance
                let loadArgs = {};
                for(const [key, value] of searchParams.entries()) if (!key.startsWith("x-")) loadArgs[key] = value;
                this._instance.load(loadArgs);
                //init
                if(label) this.label = label;
                if(icon) this.icon = icon;
                if (breadcrumb) this.breadcrumb = breadcrumb;
            } else {
                //error
                this._showError("", "Handler not implemented: " + handler, "", container);
            }
            //init
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
    async _showError(code, message, stacktrace, container) {
        var name = xshell.config.ui.errors[code];
        if (!name) name = xshell.config.ui.errors.default;
        await loader.load("component:" + name);
        let error = document.createElement(name);
        error.setAttribute("code", code);
        error.setAttribute("message", message);
        error.setAttribute("stacktrace", stacktrace);
        if (container) {
            container.appendChild(error);
        } else {
            this.appendChild(error);
        }
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
export { XPageInstance };

