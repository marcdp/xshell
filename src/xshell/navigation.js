import {combineUrls} from "./utils/urls.js";

// class
export default class Navigation {

    // vars
    _areas = null;
    _bus = null;
    _config = null;
    _container = null;

    _mode = ""; //hash|path
    _hashPrefix = "";
    _appBase = "";

    _stack = [];
    
    // ctor
    constructor( { areas, bus, config, container} ) {
        this._areas = areas;
        this._bus = bus;
        this._config = config;
        this._container = container;
        this._mode = config.get("navigation.mode") || "hash";
        this._hashPrefix = config.get("navigation.hashPrefix");
        this._appBase = this._config.get("app.base");        
    }

    // props
    get mode() { return this._mode; }
    get src() { 
        let xpage = this.getXPage();
        return (xpage ? xpage.src : null);
    }
    
    // init
    async init() {
        if (this._mode == "hash") {
            // hash mode
            window.addEventListener("hashchange", async () => {
                await this._syncFromHash(document.location.hash);
            });
            // init
            if (document.location.hash) {
                await this._syncFromHash(document.location.hash);
            } else {
                let defaultArea = this._areas.getDefaultArea();
                document.location.hash = this._hashPrefix + defaultArea.home;
            }
        } else if (this._mode == "path") {
            // path mode
            // todo ...
            window.addEventListener("popstate", async () => {
                await this._syncFromPath(document.location.pathname, document.location.search);
            });
            // init
            debugger;
            throw new Error("Path mode is not implemented yet");
        }
    }

    // methods
    getXPage() {
        // get the first page that is a direct child of the container and not a dialog
        return this.getXPages()[0];
    }
    getXPages() {
        // get pages that are direct children of the container and not dialogs
        return Array.from(this._container.querySelectorAll(":scope > x-page:not([layout='dialog'])"));
    }
    getXPageFromElement(target) {
        // get the page element from a target element by traversing up the DOM tree
        while (target) {
            if (!target.parentNode) {
                target = target.host;
            }
            if (!target) {
                return null;
            }
            if (target.localName == "x-page") return target;
            target = target.parentNode;
        }
        return null;
    }
    buildUrlAbsolute(...params){
        let href = this.buildUrl(...params);
        if (this._mode == "hash") {
            href = this._appBase + "/" + this._hashPrefix + href;
        } else {
            href = this._appBase + href;
        }
        return href;
    }
    buildUrl({
            href,           // url relative to app base
            params = {},    // ws variables to be added as query string parameters
            nav = {         // navigation data to be added as query string parameters (nav.title, nav.icon, nav.breadcrumb)
                title,      // nav.title
                icon,       // nav.icon
                breadcrumb},// nav.breadcrumb
            from,           // current xpage element for resolving relative urls
        }) {
        // produces real, navigable URLS
        if (!href || typeof href !== "string") throw new Error("buildUrl: href must be a non-empty string");
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        if (href.startsWith("#!")) href = href.substring(2);
        // resolve relative urls
        if (!href.startsWith("/")) href = combineUrls(from ? from.src : "/", href);
        // params
        for (const [k, v] of Object.entries(params)) {
            href += (href.includes("?") ? "&" : "?") + encodeURIComponent(k) + "=" + encodeURIComponent(v);
        }    
        // breadcrumb
        if (nav.breadcrumb) {
            href += (href.includes("?") ? "&" : "?") + "nav.breadcrumb=" + btoa(JSON.stringify(nav.breadcrumb)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        }
        // title
        if (nav.title) {
            href += (href.includes("?") ? "&" : "?") + "nav.title=" + encodeURIComponent(nav.title);
        }
        // icon
        if (nav.icon) {
            href += (href.includes("?") ? "&" : "?") + "nav.icon=" + encodeURIComponent(nav.icon);
        }
        // return
        return href;
    }
    parseUrl(url) {
        if (!url || typeof url !== "string") throw new Error("parseUrl: url must be a non-empty string");
        // remove hash prefix if present (#!)
        if (url.startsWith("#!")) url = url.substring(2);
        // separate path and query
        const [pathPart, queryPart] = url.split("?");
        const result = {
            href: pathPart || "",
            params: {},
            nav: {
                title: null,
                icon: null,
                breadcrumb: null
            }
        };
        if (!queryPart) return result;
        const searchParams = new URLSearchParams(queryPart);
        for (const [key, value] of searchParams.entries()) {
            if (key === "nav.title") result.nav.title = value;
            else if (key === "nav.icon") result.nav.icon = value;
            else if (key === "nav.breadcrumb") {
                try {
                    const decoded = value
                        .replace(/-/g, "+")
                        .replace(/_/g, "/");

                    const json = atob(decoded);
                    result.nav.breadcrumb = JSON.parse(json);
                } catch {
                    result.nav.breadcrumb = null;
                }
            } else {
                result.params[key] = value;
            }
        }
        return result;
    }

    async navigate({
            href,
            params = {},    // ws variables to be added as query string parameters
            nav = {         // navigation data to be added as query string parameters (nav.title, nav.icon, nav.breadcrumb)
                title,      // nav.title
                icon,       // nav.icon
                breadcrumb},// nav.breadcrumb
            from,
            open = "auto",  // auto | top | stack | dialog | embed 
            replace = false
        }) {
        //navigate
        href = this.buildUrl({ href, params, nav, from });
        // open
        if (open == "auto") {
            // auto
            const xpages = this.getXPages();
            const indexPage = xpages.indexOf(from);
            if  (from == null) {
                // top
                this._updateBrowserUrl(href, { replace });
            } else if (indexPage == 0) {
                // top
                this._updateBrowserUrl(href, { replace });
            } else if (indexPage != -1) {
                // stackpage
                // todo ...
                debugger;
            } else {
                // dialog or embed
                debugger;
                from.setAttribute("src", href);
            }
        } else if (open == "top") {
            // top
            this._updateBrowserUrl(href, { replace });
            debugger;
        } else if (open == "dialog") {
            // dialog
            await this._showDialog({ href });
        } else if (open == "stack") {
            // stack
            let aux = this._stack;
            //this._updateBrowserUrl(href, { replace });
            debugger;
        } else if (open == "embed") {
            // embed
            debugger;
        }
    }


    // private methods
    _updateBrowserUrl(url, { replace }) {
        if (this._mode === "hash") {
            if (replace) {
                location.replace(this._hashPrefix + url);
            } else {
                location.hash = this._hashPrefix + url;
            }
        } else {
            if (replace) {
                history.replaceState(null, "", this._appBase + url);
            } else {
                history.pushState(null, "", this._appBase + url);
            }
        }
    }
    async _showDialog({ href }) {
        //show page dialog
        let resolveFunc = null;
        let xpage = document.createElement("x-page");
        xpage.setAttribute("src", href);
        xpage.setAttribute("layout", "dialog");
        xpage.addEventListener("close", (event) => {
            resolveFunc(event.target.result);
            if (event.target.parentNode) {
                event.target.parentNode.removeChild(event.target);
            }
        });
        this._container.appendChild(xpage);
        return new Promise((resolve) => {
            resolveFunc = resolve;
        });
    }
    async _handleLocationChange() {
        // handle clocation change
        if (this._mode === "hash") {
            await this._syncFromHash(location.hash);
        } else {
            await this._syncFromPath(location.pathname, location.search);
        }
    }
    async _syncFromHash(hash) {
        //navigate
        let hashBeforeParts = this._stack;
        let hashAfterParts = (hash ? hash.substring(this._hashPrefix.length).split(this._hashPrefix) : []);
        let inc = 0;
        //close the last dialog
        let allXPages = Array.from(this._container.querySelectorAll(":scope > x-page"));
        for (let i = allXPages.length - 1; i >= 0; i--) {
            let xpage = allXPages[i];
            if (xpage.getAttribute("layout") != "dialog") break;
            this._container.removeChild(xpage);            
        }
        //process hash parts
        for (let i = 0; i < Math.max(hashBeforeParts.length, hashAfterParts.length); i++) {
            let hashBeforePart = hashBeforeParts[i];
            let hashAfterPart = hashAfterParts[i];
            if (!hashBeforePart && hashAfterPart) {
                //add page
                let xpage = document.createElement("x-page");
                xpage.setAttribute("src", hashAfterPart);
                if (i == 0) {
                    xpage.setAttribute("layout", "main");
                    //emit event navigation-start
                    this._bus.emit("xshell:navigation:start", { src: xpage.src });
                } else {
                    xpage.setAttribute("layout", "stack");
                    xpage.addEventListener("close", (event) => {
                        //page close
                        let xpages = this.getXPages();
                        let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                        let index = xpages.indexOf(event.target);
                        hashParts = hashParts.filter((_, idx) => idx !== index);
                        document.location.hash = this._hashPrefix + hashParts.join(this._hashPrefix);
                    });
                }
                xpage.addEventListener("change", (event) => {
                    //page change
                    let xpages = this.getXPages();
                    if (xpages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this._config.get("app.label");
                    }
                });
                xpage.addEventListener("replace", (event) => {
                    //page replace
                    let xpages = this.getXPages();
                    let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                    let index = xpages.indexOf(event.target);
                    hashParts[index] = event.target.src;
                    history.replaceState(null, "", this._hashPrefix + hashParts.join(this._hashPrefix));
                });
                xpage.addEventListener("load", (event) => {
                    //page load
                    let xpages = this.getXPages();
                    if (xpages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this._config.get("app.label");
                        this._bus.emit("xshell:navigation:end", { src: event.target.src });
                    }
                });
                xpage.addEventListener("navigate", (event) => {
                    //page navigation
                    let xpages = this.getXPages();
                    let index = xpages.indexOf(event.target);
                    if (index != -1) {
                        let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                        hashParts[index] = event.detail;
                        document.location.hash = this._hashPrefix + hashParts.join(this._hashPrefix);
                    }
                });
                //add page to container
                this._container.appendChild(xpage);
            } else if (hashBeforePart && !hashAfterPart) {
                //remove page
                let xpages = this.getXPages();
                let xpage = xpages[i + inc];
                xpage.removePage();
                inc -= 1;
            } else if (hashBeforePart != hashAfterPart) {
                //change page
                let xpages = this.getXPages();
                let xpage = xpages[i];
                xpage.src = hashAfterPart;
                //emit event navigation-start
                if (i == 0) {
                    this._bus.emit("xshell:navigation:start", { src: xpage.src });
                }
            }
        }
        this._stack = hashAfterParts;
    }
    async _syncFromPath(path) {
        // handle from path
        // todo ...
        debugger;
        throw new Error("Path mode is not implemented yet");
    }
    _serializeStack(stackArray){
        debugger;
    }
    _deserializeStack(string){
        debugger;
    }

}

