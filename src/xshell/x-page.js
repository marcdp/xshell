import xshell from "./xshell.js";
import Utils from "./utils.js";


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
    //_srcPage = "";
    _layout = "";
    _status = "";

    _loading = "";
    _loadingObserver = null;
    _module = null;
    _page = null;
    //_context = null;
    

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.addEventListener("query-close", () => {
            this.queryClose();
        });
        this.addEventListener("command", (event) => {
            this.onCommand(event.detail.command, event.detail.data, { event });
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
        this.addEventListener("click", (event) => {
            const anchor = event.target.closest("a");
            if (!anchor || !this.contains(anchor)) return;
            if (false) {
                // todo: intercept path navigation urls (without #!)
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
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
            //this._result = null;
            if (this._src && this._connected) this.load();
        }
    }
    get srcPage() {return this._srcPage;}

    get status() {return this._status;}
    
    get breadcrumb() {return this._breadcrumb;}
    set breadcrumb(value) {this._breadcrumb = value;}

    get result() {return this.page.result;}
    set result(value) {debugger; this.page.result = value;}

    get layout() { return this._layout;}
    set layout(value) { this._layout = value;}

    get module() { return this._module; }
    set module(value) { this._module = value; }

    //get context() { return this._context; }
    //set context(value) { this._context = value; }

    get label() {return this._page.label;}
    set label(value) {
        debugger;
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
        //destroy previous page
        this.unload();
        this._connected = false;
    }


    //methods    
    async load() {
        xshell.debug.log(`x-page: load '${this.src} ...`);
        let src = this.src;
        if (src.indexOf("error") != -1) {
            debugger;
            return;
        }
        //reset
        this._status = "loading";
        //set layout as loading (if exists)
        let layoutElement = this.shadowRoot.firstChild;
        if (layoutElement) {
            layoutElement.setAttribute("status", "loading");
        }
        //load module 
        let moduleName = await xshell.modules.resolveModuleName(src);
        this.setAttribute("module", moduleName ?? "");
        if (!moduleName) {
            this.error({ code: 404, message: "Module not registered for page path: " + src, src: src});            
            return;
        }        
        //fetch page
        let page = null;
        try {
            const pageClass = await xshell.loader.load("page:" + src);
            page = new pageClass( {src} );
        } catch(e) {
            debugger;
            let message = "x-page: error loading page '" + src + "': " + e.message;
            xshell.debug.error(message, e);
            this.error({ 
                code: 404, 
                message: message, 
                src: src, 
                stack: e.stack
            });
            return;
        }                 
        //search params
        let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1).split("#")[0] : "");
        //layout
        let layoutName = this._layout;
        if (searchParams.get("xshell-page-layout")) {
            layoutName = searchParams.get("xshell-page-layout");
            searchParams.delete("xshell-page-layout");
        }
        if (!layoutName) layoutName = "embed";
        let layout = xshell.config.get("page.layout." + layoutName);
        let layoutClass = await xshell.loader.load("layout:" + layout);
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
        //xshell-page-src
        let srcPage = "";
        if (searchParams.get("xshell-page-src")) {
            srcPage = searchParams.get("xshell-page-src");
            searchParams.delete("xshell-page-src");
        }
        this._srcPage = srcPage;
        //menuitem
        let menu = xshell.config.get("modules." + moduleName + ".menus.main", {});
        let menuitems = Utils.findObjectsPath(menu, 'href', src.split("#")[0]);
        let menuitem = (menuitems ? menuitems[menuitems.length-1] : null);  
        //title
        let label = page.label;
        let labelForced = null;
        if (!label && menuitems) label = menuitem.label;
        if (searchParams.get("xshell-page-label")) {
            label = searchParams.get("xshell-page-label");
            labelForced = label;
            searchParams.delete("xshell-page-label");
        }
        page.label = label;
        //icon
        let icon = page.icon;
        if (!icon && menuitem) icon = menuitem.icon;
        if (searchParams.get("xshell-page-icon")) {
            icon = searchParams.get("xshell-page-icon");
            searchParams.delete("xshell-page-icon");
        }
        page.icon = icon;
        //breadcrumb
        let breadcrumb = [];
        if (searchParams.get("xshell-page-breadcrumb")) {
            breadcrumb = JSON.parse(atob(searchParams.get("xshell-page-breadcrumb").replace(/_/g, "/").replace(/-/g, "+")));
            breadcrumb.push({ label: label, href: src });
            searchParams.delete("xshell-page-breadcrumb");
        } else if (menuitems) {
            for(let i = 0; i <menuitems.length; i++) {
                let menuitem = menuitems[i];
                breadcrumb.push({ label: menuitem.label, href: menuitem.href });
            }
        }
        this.breadcrumb = breadcrumb;        
        // unmount previous page
        await this.unmount();
        // unload previous page
        await this.unload();
        // set new page
        this._page = page;
        // set as loaded
        if (this._status == "loading") {
            this._status = "loaded"; 
        }
        //remove loading
        if (layoutElement) layoutElement.removeAttribute("status");
        //load status
        this._loadStatus = 200;
        // call load on page
        await this._page.load();
        // call mount on page
        await this._page.mount( { host: this });
        //raise load event
        this.dispatchEvent(new CustomEvent("load"));
    }
    error({code, message, src, stack}) {
        //error
        let url = xshell.config.get("xshell.url.error");
        if (url.indexOf("?") == -1) url += "?";
        url += "code=" + encodeURIComponent(code);
        url += "&message=" + encodeURIComponent(message);
        url += "&src=" + encodeURIComponent(src);
        url += "&xshell-page-src=" + encodeURIComponent(src);
        xshell.debug.error("x-page: error loading page: " + message + " (code: " + code + ", src: " + src + ")");
        if (stack) url += "&stack=" + encodeURIComponent(stack);
        this.src = url;
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
    async unmount() {
        //unmount
        if (this._page) {
            await this._page.unmount();
        }
    }
    async unload() {
        //unload
        if (this._page) {
            await this._page.unload();
        }
    }
    async queryClose() {
        let allowClose = true;
        // ... query close page (ask page for permissions to close) ...
        if (allowClose) this.close();
    }
    async close(result) {
        //close page
        if (result != undefined) this._page.result = result;
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
        if (this._page && this._page.onCommand) {
            await this._page.onCommand(command, args);
        }
    }

}

//define web component
customElements.define('x-page', XPage);

//export 
export default XPage;