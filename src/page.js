import shell from "./shell.js";
import loader from "./loader.js";
import config from "./config.js";
import utils from "./utils.js";
import PageInstance from "./page-instance.js";

 

// class
class Page extends HTMLElement {


    //static
    static get observedAttributes() { 
        return ["src", "layout", "module", "loading"]; 
    }


    //fields
    _connected = false;
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
        this.addEventListener("query-close", () => {
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

    get status() {return this._status;}
    
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
            this.dispatchEvent(new CustomEvent("change"));
        }
    }

    get icon() {return this._icon;}
    set icon(value) {
        let changed = (this._icon != value);
        this._icon = value; 
        if (changed) {
            this.dispatchEvent(new CustomEvent("change"));
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
        //load now, or on the first activation
        if (this.loading == "lazy") {
            //intersection observer
            const onIntersection = (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (this.loading == "lazy" && this._status == "") {
                            this.load();
                        }
                    }
                });
            };
            // set up the IntersectionObserver
            this._loadingObserver = new IntersectionObserver(onIntersection, {rootMargin: "10px"}); // start loading just before it comes into view
            this._loadingObserver.observe(this); // start observing the element

        } else if (this._src) {
            this.load();
        }
    }
    disconnectedCallback() {
        //destroy previous instance
        this.unload();
        this._connected = false;
    }


    //methods    
    async load() {
        console.log(`page.load('${this.src}') ************************************`);
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        //search params
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?") + 1) : "");
        //set layout as loading (if exists)
        let layoutElement = this.shadowRoot.firstChild;
        if (layoutElement) {
            layoutElement.setAttribute("status", "loading");
        }
        //load module 
        let module = await shell.loadModuleBySrc(this.src);
        this.setAttribute("module", module ? module.name : "");
        if (!module) throw new Error(`Module not found for page '${this.src}'`);
        //fetch page
        let response = await loader.load("page:" + this.src);

        // at this point, we mjst have text/html
        // the developer should configure the required transformer, to convert any contenttype to html
        
        let text = await response.text();   
        let shellErrorName = config.get("shell.error") || "div";
        let shellLazyName = config.get("shell.lazy");
        if (shellErrorName.indexOf("-") != -1) await loader.load("component:" + shellErrorName);
        if (!response.ok) {
            //error
            this._status = "error"; 
            if (!text) {
                text = `<${shellErrorName} code="${response.status}">${response.statusText}: ${this.src}</${shellErrorName}>`;
            }
        } else {
            //load referenced components in the page
            let docWithoutTemplate = (new DOMParser()).parseFromString(text.replace("<template>","<div>").replace("</template>","</div>"), "text/html");
            let componentNames = [...new Set(Array.from(docWithoutTemplate.querySelectorAll('*')).filter(el => {
                if (el.tagName.includes('-')) if (shellLazyName && (el.localName == shellLazyName || el.closest(shellLazyName) == null)) return true;
                return false;
            }).map(el => el.tagName.toLowerCase()))];
            if (componentNames.length) {
                let resourceNames = [];
                componentNames.forEach((componentName) => resourceNames.push("component:" + componentName));
                try {
                    await loader.load(resourceNames);
                } catch (e) {
                    this._status = "error";
                    let errorTexts = [];
                    if (e.errors) {
                        for(let error of e.errors) {
                            errorTexts.push(`<${shellErrorName} code="0">${error}</${shellErrorName}>`);
                        }
                    } else {
                        errorTexts.push(`<${shellErrorName} code="0">${e.message}</${shellErrorName}>`);
                    }
                    if (errorTexts.length) {
                        text = errorTexts.join("");
                    }
                }
            }
        }
        //parse html
        let html = text;
        if (html.indexOf("<html") == -1) html = "<html><body>" + html + "</body></html>";
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, "text/html");
        //layout
        let layoutName = this._layout;
        doc.head.querySelectorAll("meta[name='layout']").forEach((sender) => { layoutName = sender.content || layoutName; });
        let layout = config.get("pages.layout." + (layoutName || "embed"));
        await loader.load("layout:" + layout);
        if (layoutElement == null || layoutElement.localName != layout) {
            if (layoutElement) layoutElement.remove();
            layoutElement = document.createElement(layout);
            layoutElement.innerHTML = "<slot></slot>";
            this.shadowRoot.appendChild(layoutElement);
            layoutElement.setAttribute("status", "loading");
        }        
        //delay
        //    if (document.body.querySelectorAll(":scope > page").length > 1) {
        //        await new Promise(r => setTimeout(r, 1000));                
        //    }
        //menuitem
        let menu = config.get("modules." + module.name + ".menus.main", {});
        let menuitems = utils.findObjectsPath(menu, 'href', this.src);
        let menuitem = (menuitems ? menuitems[menuitems.length-1] : null);  
        //label
        let label = doc.title;
        doc.head.querySelectorAll("meta[name='label']").forEach((sender) => { label = sender.content; });
        if (!label && menuitems) label = menuitem.label;
        if (searchParams.get("page-label")) label = searchParams.get("page-label");
        this.label = label;
        //icon
        let icon = "";
        doc.head.querySelectorAll("meta[name='page-icon']").forEach((sender) => { icon = sender.content; });
        if (!icon && menuitem) icon = menuitem.icon;
        if (searchParams.get("page-icon")) icon = searchParams.get("page-icon");
        this.icon = icon;
        //breadcrumb
        let breadcrumb = [];
        if (searchParams.get("page-breadcrumb")) {
            breadcrumb = JSON.parse(atob(searchParams.get("page-breadcrumb").replace(/_/g, "/").replace(/-/g, "+")));
            breadcrumb.push({ label: label, href: this.src });
        } else if (menuitems) {
            for(let i = 0; i <menuitems.length; i++) {
                let menuitem = menuitems[i];
                breadcrumb.push({ label: menuitem.label, href: menuitem.href });
            }
        }
        this.breadcrumb = breadcrumb;        
        //handler
        let instance = null;
        let handler = config.get("modules." + module.name + ".page-handler", config.get("page-handler", ""));
        doc.querySelectorAll("meta[name='page-handler']").forEach((sender) => { handler = sender.content; });
        if (searchParams.get("page-handler")) handler = searchParams.get("page-handler");
        if (this.status == "error") handler = "";
        if (handler == "") {
            instance = new PageInstance();
        } else {
            let classs = await loader.load("page-handler:" + handler);
            instance = new classs();
        }
        //destroy previous instance
        await this.unload();
        //init new instance
        this._instance = instance;
        let srcAbsolute = utils.combineUrls(module.src, "." + this.src.substring(module.path.length));
        await this._instance.init(doc, srcAbsolute, this);
        //set as loaded
        if (this._status == "loading") {
            this._status = "loaded"; 
        }
        //remove loading
        if (layoutElement) layoutElement.removeAttribute("status");
        //call load on instance
        await this._instance.load();
        //raise load event
        this.dispatchEvent(new CustomEvent("load"));
    }
    async unload() {
        //unload
        if (this._instance) {
            console.log(`page.unload('${this._instance.src}')`);
            await this._instance.unload();
        }
    }
    navigate(src, settings) {
        //navigate to
        if (!settings) settings = {};
        if (settings.breadcrumb){
            src += (src.indexOf("?") != -1 ? "&" : "?") + "page-breadcrumb=" + btoa(JSON.stringify(this.breadcrumb)).replace(/\+/g, "-").replace(/\//g, "_");
        }
        if (this.layout == "main" || this.layout == "stack") {
            this.dispatchEvent(new CustomEvent("navigate", {detail: src}));
        } else {
            this.src = src;
        }
    }
    async showPage({ src, sender, target }) {       
        //show page stack
        shell.showPage( { src, sender, target });
    }
    async showPageStack({ src }) {
        //show page stack
        shell.showPageStack( { src });
    }
    async showPageDialog({ src, sender }) {        
        //show page dialog
        return await shell.showPageDialog( {src, sender });
    }
    async queryClose() {
        let allowClose = true;
        // ... query close page (ask page for permissions to close) ...
        if (allowClose) this.close();
    }
    async close(result) {
        //close page
        if (result != undefined) this._result = result;
        this.dispatchEvent(new CustomEvent("close", { composed: true }));
    }
    async removePage() {
        //remove dom element
        let layoutElement = this.shadowRoot.firstChild;
        let removeHandler = ()=> {
            this.remove();
        };
        if (layoutElement) {
            removeHandler = layoutElement.onCommand("unload") || removeHandler;
        }
        //remove DOM node
        removeHandler();
    }
    async onCommand(command, args) {
        //command
        if (this._instance && this._instance.onCommand) {
            await this._instance.onCommand(command, args);
        }
    }

}

//define web component
customElements.define('x-page', Page);

//export 
export default Page;