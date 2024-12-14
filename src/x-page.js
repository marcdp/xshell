import shell from "./shell.js";
import loader from "./loader.js";
import config from "./config.js";
import utils from "./utils.js";


// default page handler
const defaultPageFactory = async function (doc, src, container) {
    let result = null;
    container.replaceChildren();
    for(var i = 0; i < doc.body.childNodes.length; i++) {
        let node = doc.body.childNodes[i];
        if (node.localName == "script") {
            let script = node;
            let newScript = document.createElement("script");
            for (var j = 0; j < script.attributes.length; j++) {
                newScript.setAttribute(script.attributes[j].name, script.attributes[j].value);
            }
            newScript.textContent = script.textContent;
            container.appendChild(newScript);
        } else {
            container.appendChild(node.cloneNode(true));
        }
    };
    return result;
};


// class
class XPage extends HTMLElement {


    //static
    static get observedAttributes() { 
        return ["src", "layout", "module", "loading"]; 
    }


    //fields
    _connected = false;
    _connectedAt = null;
    _breadcrumb = [];
    _src = "";
    _layout = "";
    _status = "";
    _result = null;
    _label = "";
    _icon = "";
    _loading = "";
    _loadingObserver = null;
    _module = null;
    _instance = null;


    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.addEventListener("page:query-close", () => {
            this.queryClose();
        });
        this.addEventListener("command", (event) => {
            this.onCommand(event.detail.command, { event, data: event.detail.data });
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
    }


    //props
    get src() {return this._src;}
    set src(value) {
        let changed = (this._src != value);
        if (!value.startsWith("/") && value.indexOf("://") == -1 && this.src) {
            let aux = this.src;
            aux = aux.substring(0, aux.lastIndexOf("/"));   
            value = aux + "/" + value;
        }
        this._src = value; 
        if (changed){
            this._breadcrumb = [];
            this._result = null;
            if (this._src && this._connected) this.load();
        }
    }

    get breadcrumb() {return this._breadcrumb;}
    set breadcrumb(value) {this._breadcrumb = value;}

    get result() {return this._result;}
    set result(value) {this._result = value;}

    get layout() { return this._layout;}
    set layout(value) { this._layout = value;}

    get module() { return this._module; }
    set module(value) { this._module = value; }

    get label() {return this._label;}
    set label(value) {
        let changed = (this._label != value);
        this._label = value; 
        if (changed) {
            this.dispatchEvent(new CustomEvent("page:change"));
        }
    }

    get icon() {return this._icon;}
    set icon(value) {
        let changed = (this._icon != value);
        this._icon = value; 
        if (changed) {
            this.dispatchEvent(new CustomEvent("page:change"));
        }
    }


    //events
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "src") this.src = newValue;
        if (name == "layout") this.layout = newValue;
        if (name == "module") this.module = newValue;
        if (name == "loading") this.loading = newValue;
    }
    connectedCallback() {
        this._connected = true;
        if (this.loading == "lazy") {
            //intersection observer
            const onIntersection = (entries, observer) => {
                entries.forEach(entry => {
                  if (entry.isIntersecting) {
                      this.load();
                    observer.disconnect(); // Stop observing once loaded
                  }
                });
            };
            // set up the IntersectionObserver
            this._loadingObserver = new IntersectionObserver(onIntersection, {
                rootMargin: '10em' // start loading just before it comes into view
            });
            // start observing the element
            this._loadingObserver.observe(this);
        } else if (this._src) {
            this.load();
        }
    }
    disconnectedCallback() {
        this._connected = false;
    }


    //methods    
    async load() {
        console.log(`x-page.load('${this.src}')`);        
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        //search
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?") + 1) : "");
        //load module 
        let module = await shell.loadModuleBySrc(this.src);
        this.setAttribute("module", module ? module.name : "");
        //load layout
        let layoutElement = null;
        let layout = config.get("pages.layout." + (this._layout || "embed"));
        await loader.load("layout:" + layout);
        layoutElement = this.shadowRoot.firstChild;
        if (layoutElement == null || layoutElement.localName != layout) {
            layoutElement = document.createElement(layout);
            this.shadowRoot.appendChild(layoutElement);
        }
        layoutElement.setAttribute("status", "loading");
        //delay
        //    if (document.body.querySelectorAll(":scope > x-page").length > 1) {
        //        await new Promise(r => setTimeout(r, 1000));                
        //    }
        //load page
        let src = utils.combineUrls(module.src, "." + this.src.substring(module.path.length))
        let response = await fetch(src);
        let contentType = response.headers.get("Content-Type");
        let content = await response.text();   
        if (!response.ok) {
            this._status = "error"; 
            this._showError(response.status, response.statusText, "");
            if (layoutElement) layoutElement.removeAttribute("status");
            return;
        }
        if (contentType.indexOf("text/html") != -1) {
            //do nothing
        } else {
            this._status = "error";
            this._showError(response.status, response.statusText, "");
            if (layoutElement) layoutElement.removeAttribute("status");
            return;
        }        
        //fetch ok
        let html = content;
        if (html.indexOf("<html") == -1) html = "<html><body>" + html + "</body></html>";
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, "text/html");        
        //load required components
        let componentNames = [...new Set(Array.from(doc.querySelectorAll('*')).filter(el => {
            if (el.tagName.includes('-')) {
                if (el.tagName == "X-LAZY" || el.closest("x-lazy") == null) {
                    return true;
                }
            }
            return false;
        }).map(el => el.tagName.toLowerCase()))];
        if (componentNames.length) {
            let resourceNames = [];
            componentNames.forEach((componentName) => {
                resourceNames.push("component:" + componentName);
            });
            await loader.load(resourceNames);
        }
        //label
        let label = doc.title;
        doc.head.querySelectorAll("meta[name='x-label']").forEach((sender) => { label = sender.content; });
        if (searchParams.get("x-label")) label = searchParams.get("x-label");
        //icon
        let icon = "";
        doc.head.querySelectorAll("meta[name='x-icon']").forEach((sender) => { icon = sender.content; });
        if (searchParams.get("x-icon")) icon = searchParams.get("x-icon");
        //breadcrumb
        let breadcrumb = [];
        if (searchParams.get("x-breadcrumb")) breadcrumb = JSON.parse(atob(searchParams.get("x-breadcrumb").replace(/_/g, "/").replace(/-/g, "+")));
        //factory
        let factory = config.get("modules." + module.name + ".pages.factory", config.get("pages.factory", ""));
        doc.querySelectorAll("meta[name='pages.factory']").forEach((sender) => { factory = sender.content; });
        if (factory == ""){
            this._insstance = await defaultPageFactory(doc, src, this);
        } else {
            let handlerFunction = await loader.load("function:x-page-handler-" + factory);
            this._instance = await handlerFunction(doc, src, this);            
        }
        //set label, icon and breadcrumb
        if (label) this.label = label;
        if (icon) this.icon = icon;
        if (breadcrumb) this.breadcrumb = breadcrumb;
        //set as loaded
        this._status = "loaded"; 
        //remove loading
        if (layoutElement) layoutElement.removeAttribute("status");
        //call load on instance
        //raise load event
        this.dispatchEvent(new CustomEvent("page:load"));
    }
    navigate(src) {
        //navigate to
        if (this.layout == "main" || this.layout == "stack") {
            this.dispatchEvent(new CustomEvent("page:navigate", {detail: src}));
        } else {
            this.src = src;
        }
    }
    async queryClose() {
        let allowClose = true;
        // ... query close page (ask page for permissions to close) ...
        if (allowClose) this.close();
    }
    async close(result) {
        //close page
        if (result != undefined) this._result = result;
        this.dispatchEvent(new CustomEvent("page:close", { composed: true }));
    }
    async onCommand(command, args) {
        //command
        if (this._instance && this._instance.onCommand) {
            await this._instance.onCommand(command, args);
        }
    }


    //private methods
    async _showError(code, message, stacktrace) {
        var name = config.get("shell.error");
        await loader.load("component:" + name);
        let error = document.createElement(name);
        error.setAttribute("code", code);
        error.setAttribute("message", message);
        error.setAttribute("stacktrace", stacktrace || "");
        this.replaceChildren();
        this.appendChild(error);
    }

    
}

//define web component
customElements.define('x-page', XPage);

//export 
export default XPage;
