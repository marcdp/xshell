import loader from "./loader.js";
import xshell from "./x-shell.js";


// class
class XPage extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["src", "type", "loading"]; 
    }

    //fields
    _connected = false;
    _connectedAt = null;
    _breadcrumb = [];
    _src = "";
    _type = "";
    _status = "";
    _result = null;
    _label = "";
    _icon = "";
    _loading = "";
    _loadingObserver = null;

    //ctor
    constructor() {
        super();
    }

    //props
    get src() {return this._src;}
    set src(value) {
        let changed = (this._src != value);
        if (!value.startsWith("page:") && !value.startsWith("/") && value.indexOf("://") == -1 && this.src) {
            let aux = this.src;
            aux = aux.substring(0, aux.lastIndexOf("/"));   
            value = aux + "/" + value;
        }
        this._src = value; 
        if (changed){
            this._breadcrumb = [];
            this._result = null;
            if (this._src && this._connected) this.loadPage();
        }
    }

    get breadcrumb() {return this._breadcrumb;}
    set breadcrumb(value) {this._breadcrumb = value;}

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
        if (name == "loading") this.loading = newValue;
    }
    connectedCallback() {
        this._connected = true;
        if (this.loading == "lazy") {
            //intersection observer
            const onIntersection = (entries, observer) => {
                entries.forEach(entry => {
                  if (entry.isIntersecting) {
                    this.loadPage();
                    observer.disconnect(); // Stop observing once loaded
                  }
                });
            };
            // set up the IntersectionObserver
            this._loadingObserver = new IntersectionObserver(onIntersection, {
                rootMargin: '100px' // start loading just before it comes into view
            });
            // start observing the element
            this._loadingObserver.observe(this);

        } else if (this._src) {
            this.loadPage();
        }
    }
    disconnectedCallback() {
        this._connected = false;
    }

    //methods
    onCommand(command) {  
        if (command == "load") {
        }
    }
    async showPage({url, target}) {
        await xshell.showPage({url, target, sender:this});
    }
    async showDialog({url}) {
        return xshell.showDialog({url, sender:this});
    }
    close(result) {
        if (result != undefined) this._result = result;
        this._raisePageCloseEvent();
    }
    hideAndRemove(){
        let dialog = this.querySelector(":scope > dialog");
        if (dialog) {
            dialog.addEventListener("transitionend", () => {
                if (this.parentNode){
                    this.parentNode.removeChild(this);
                }
            });
            dialog.classList.remove("visible");
        } else {
            this.parentNode.removeChild(this);
        }
    }
    async loadPage(settings) {
        console.log(`x-page.loadPage('${this.src}')`);        
        if (!settings) settings = {
            useAnimation: (new Date() - xshell.startedAt) > 250
        };
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        //search
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?") + 1) : "");
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
                    if (event.target == dialog) {
                        event.preventDefault();
                        event.stopPropagation();
                        this._raisePageCloseEvent();
                    }
                });
                if (!settings.useAnimation) {
                    dialog.classList.add("visible");
                }
                this.appendChild(dialog);
                dialog.showModal();
            }
        }
        //loading
        let loadingComponentName = xshell.config.ui.components.pageLoading;
        await loader.load("component:" + loadingComponentName);
        let loadingComponent = document.createElement(loadingComponentName);
        loadingComponent.setAttribute("type", this._type);
        (dialog || this).appendChild(loadingComponent);
        //await new Promise(r => setTimeout(r, 1000));
        //debugger
        //animation
        if (dialog){
            if (settings.useAnimation) {
                dialog.classList.add("visible");
            }
        }
        //load html page
        let src = this.src;        
        if (src.startsWith("page:")) {
            src = loader.resolveSrc(src.split("?")[0]);
        } else if (!src.startsWith("/") && src.indexOf("://") == -1) {
            if (this.parentNode) {
                let page = this.parentNode.closest("x-page");
                if (page) {
                    let aux = page.src;
                    aux = aux.substring(0, aux.lastIndexOf("/"));   
                    src = aux + "/" + src;
                }
            }
            if (src.indexOf("://") == -1) src = xshell.config.navigator.base + src;
        } else {
            if (src.indexOf("://") == -1) src = xshell.config.navigator.base + src;
        }
        let response = await fetch(src);
        let contentType = response.headers.get("Content-Type");
        let content = await response.text();   
        if (!response.ok) {
            //error
            this._status = "error"; 
            loadingComponent.parentNode.removeChild(loadingComponent);
            this._showError(response.status, response.statusText, "", this);
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
            let componentNames = [...new Set(Array.from(doc.querySelectorAll('*')).filter(el => { 
                if (el.tagName.includes('-')) {
                    if (el.tagName == "X-LAZY" || el.closest("x-lazy") == null) {
                        return true;
                    }
                }
                return false;    
            }).map(el => el.tagName.toLowerCase()))];
            if (componentNames) {
                let resourceNames = [];
                componentNames.forEach((componentName) => {
                    resourceNames.push("component:" + componentName);
                });
                await loader.load(resourceNames);          
            }
            //container
            let container = dialog || this;
            container.replaceChildren();
            if (layout) {
                let layoutElement = document.createElement(layout);
                container.appendChild(layoutElement);
                container = layoutElement;
            }
            //handler
            let handler = xshell.config.ui.components.pageHandler;
            doc.head.querySelectorAll("meta[name='x-page:handler']").forEach((sender) => { handler = sender.content; });
            //label
            if(label) this.label = label;
            if(icon) this.icon = icon;
            if (breadcrumb) this.breadcrumb = breadcrumb;
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

            } else {
                //load 
                await loader.load("component:" + handler);
                let instance = document.createElement(handler);
                await instance.init(doc, src);
                container.appendChild(instance);
            }
            //set as loaded
            this._status = "loaded"; 
            //remove loading
            if (loadingComponent.parentNode) {
                loadingComponent.parentNode.removeChild(loadingComponent);
            }
            //raise load event
            this._raisePageLoadEvent();
        }
    }    

    //private methods
    async _showError(code, message, stacktrace, container) {
        var name = xshell.config.ui.components.errorHandler;
        await loader.load("component:" + name);
        let error = document.createElement(name);
        error.setAttribute("code", code);
        error.setAttribute("message", message);
        error.setAttribute("stacktrace", stacktrace || "");
        container.replaceChildren();
        container.appendChild(error);
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
