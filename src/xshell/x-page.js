import xshell from "./xshell.js";
import loader from "./loader.js";
import config from "./config.js";
import utils from "./utils.js";
import bus from "./bus.js";
import PageInstance from "./page-instance.js";

// class
class XPage extends HTMLElement {


    //static
    static get observedAttributes() { 
        return ["src", "layout", "module", "loading"]; 
    }


    //fields
    _connected = false;
    _breadcrumb = [];
    _src = "";
    _srcPage = "";
    _srcAbsolute = "";
    _layout = "";
    _status = "";
    _statusPage = "";
    _result = null;
    _label = "";
    _icon = "";
    _loading = "";
    _loadingObserver = null;
    _module = null;
    _instance = null;
    _stats = null;
    

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
    get srcPage() {return this._srcPage;}
    get srcAbsolute() {
        return loader.resolveSrc("page:" + this.src);
    }

    get status() {return this._status;}
    get statusPage() {return this._statusPage;}
    
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
            if (this._breadcrumb && this._breadcrumb.length > 0) this._breadcrumb[this._breadcrumb.length - 1].label = value;
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

    get stats() {return this._stats;}

    
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
        console.log(`xpage.load('${this.src}') ************************************`);
        let src = this.src;
        if (src.indexOf("error") != -1) {
            debugger;
            return;
        }
        //reset
        this._result = null;
        this._label = "";
        this._icon = "";
        this._status = "loading";
        this._statusPage = "";
        //set layout as loading (if exists)
        let layoutElement = this.shadowRoot.firstChild;
        if (layoutElement) {
            layoutElement.setAttribute("status", "loading");
        }
        //load module 
        let moduleName = await xshell.resolveModuleName(src);
        this.setAttribute("module", moduleName ?? "");
        if (!moduleName) {
            this.error({ 
                code: 404, 
                message: "Module not registered for page path: " + src, 
                src: src
            });            
            return;
        }        
        //stats
        let stats = {
            loadBegin: performance.now(),
            loadEnd: null,
            loadTime: NaN,
            loadSize: 0
        };
        //fetch page
        let html = null;
        try {
            let loaderStats = {};
            html = await loader.load("page:" + src, loaderStats);
            stats.loadSize = loaderStats.loadSize;        
        } catch(e) {
            this.error({ 
                code: 404, 
                message: "Error loading page: " + e.message, 
                src: src, 
                stack: e.stack
            });
            return;
        }
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, "text/html");    
        //load referenced components in the page
        let shellLazyName = config.get("xshell.lazy");
        let docWithoutTemplate = (new DOMParser()).parseFromString(html.replace("<template>","<div>").replace("</template>","</div>"), "text/html");
        let componentNames = [...new Set(Array.from(docWithoutTemplate.querySelectorAll('*')).filter(el => {
            if (el.tagName.includes('-')) if (shellLazyName && (el.localName == shellLazyName || el.closest(shellLazyName) == null)) return true;
            return false;
        }).map(el => "component:" + el.tagName.toLowerCase()))];
        if (componentNames.length) {
            try {
                await loader.load(componentNames);
            } catch (e) {
                let errorTexts = [];
                if (e.errors) {
                    for(let error of e.errors) errorTexts.push(error);
                } else {
                    errorTexts.push(e.message);
                }
                this.error({ 
                    code:0, 
                    message: errorTexts.join(""), 
                    src: src
                });
                return;
            }
        }                
        //search params
        let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1).split("#")[0] : "");
        //layout
        let layoutName = this._layout;
        doc.head.querySelectorAll("meta[name='page-layout']").forEach((sender) => { layoutName = sender.content || layoutName; });
        if (searchParams.get("page-layout")) {
            layoutName = searchParams.get("page-layout");
            searchParams.delete("page-layout");
        }
        if (!layoutName) layoutName = "embed";
        let layout = config.get("pages.layout." + layoutName);
        await loader.load("layout:" + layout);
        if (layoutElement == null || layoutElement.localName != layout) {
            if (layoutElement) layoutElement.remove();
            layoutElement = document.createElement(layout);
            layoutElement.innerHTML = "<slot></slot>";
            this.shadowRoot.appendChild(layoutElement);
            layoutElement.setAttribute("status", "loading");
        }        
        this._layout = layoutName;
        //delay
        //    if (document.body.querySelectorAll(":scope > page").length > 1) {
        //        await new Promise(r => setTimeout(r, 1000));                
        //    }
        //page-src
        let srcPage = "";
        if (searchParams.get("page-src")) {
            srcPage = searchParams.get("page-src");
            searchParams.delete("page-src");
        }
        this._srcPage = srcPage;
        //menuitem
        let menu = config.get("modules." + moduleName + ".menus.main", {});
        let menuitems = utils.findObjectsPath(menu, 'href', src.split("#")[0]);
        let menuitem = (menuitems ? menuitems[menuitems.length-1] : null);  
        //label
        let label = doc.title;
        doc.head.querySelectorAll("meta[name='page-label']").forEach((sender) => { label = sender.content; });
        if (!label && menuitems) label = menuitem.label;
        if (searchParams.get("page-label")) {
            label = searchParams.get("page-label");
            searchParams.delete("page-label");
        }
        this.label = label;
        //icon
        let icon = "";
        doc.head.querySelectorAll("meta[name='page-icon']").forEach((sender) => { icon = sender.content; });
        if (!icon && menuitem) icon = menuitem.icon;
        if (searchParams.get("page-icon")) {
            icon = searchParams.get("page-icon");
            searchParams.delete("page-icon");
        }
        this.icon = icon;
        //breadcrumb
        let breadcrumb = [];
        if (searchParams.get("page-breadcrumb")) {
            breadcrumb = JSON.parse(atob(searchParams.get("page-breadcrumb").replace(/_/g, "/").replace(/-/g, "+")));
            breadcrumb.push({ label: label, href: src });
            searchParams.delete("page-breadcrumb");
        } else if (menuitems) {
            for(let i = 0; i <menuitems.length; i++) {
                let menuitem = menuitems[i];
                breadcrumb.push({ label: menuitem.label, href: menuitem.href });
            }
        }
        this.breadcrumb = breadcrumb;        
        //handler
        let instance = null;
        let handler = config.get("modules." + moduleName + ".page-handler", config.get("page-handler", ""));
        doc.querySelectorAll("meta[name='page-handler']").forEach((sender) => { handler = sender.content; });
        if (searchParams.get("page-handler")) {
            handler = searchParams.get("page-handler");
            searchParams.delete("page-handler");
        }
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
        await this._instance.init(doc, this);
        //set as loaded
        if (this._status == "loading") {
            this._status = "loaded"; 
        }
        //remove loading
        if (layoutElement) layoutElement.removeAttribute("status");
        //stats
        stats.loadEnd = performance.now();
        stats.loadTime = parseInt(stats.loadEnd - stats.loadBegin);
        this._stats = stats;
        //load status
        this._loadStatus = 200;
        //call load on instance
        await this._instance.load();        
        //raise load event
        this.dispatchEvent(new CustomEvent("load"));
        //bus event
        bus.emit("page-load", { page: instance });
    }
    error({code, message, src, stack}) {
        //error
        let url = config.get("xshell.error");
        if (url.indexOf("?") == -1) url += "?";
        url += "code=" + encodeURI(code);
        url += "&message=" + encodeURI(message);
        url += "&src=" + encodeURI(src);
        url += "&page-src=" + encodeURI(src);
        if (stack) url += "&stack=" + encodeURI(stack);
        this.src = url;
        this._statusPage = "error";
    }
    replace(src) {
        //replace
        let value = this.src;
        if (src.startsWith("?")) {
            let aux = value.indexOf("?");
            if (aux != -1) value = value.substring(0, aux);
            value += (src != "?" ? src : "");
        } else if (src.startsWith("#")) {
            let aux = value.indexOf("#");
            if (aux != -1) value = value.substring(0, aux);
            value += (src != "#" ? src : "");
        } else {
            value = src;
        }
        if (this._breadcrumb && this._breadcrumb.length > 0) {
            this._breadcrumb[this._breadcrumb.length - 1].href = value;
        }
        if (this._src != value) {
            this._src = value;
            this.dispatchEvent(new CustomEvent("replace", {detail: {src: this._src}}));
        }
    }
    async unload() {
        //unload
        if (this._instance) {
            console.log(`xpage.unload('${this._instance.src}')`);
            await this._instance.unload();
        }
    }
    navigate(src, settings) {
        //navigate to
        if (!settings) settings = {};
        if (settings.breadcrumb) {
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
        xshell.showPage( { src, sender, target });
    }
    async showPageStack({ src }) {
        //show page stack
        xshell.showPageStack( { src });
    }
    async showPageDialog({ src, sender }) {        
        //show page dialog
        return await xshell.showPageDialog( {src, sender });
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
customElements.define('x-page', XPage);

//export 
export default XPage;