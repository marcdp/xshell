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
    
    // ctor
    constructor( { areas, bus, config, container} ) {
        this._areas = areas;
        this._bus = bus;
        this._config = config;
        this._container = container;
        this._mode = config.get("navigation.mode");
        this._hashPrefix = config.get("navigation.hashPrefix");
    }

    // props
    get mode() { return this._mode; }
    get src() { 
        let page = this.getPage();
        return (page ? page.src : null);
    }
    
    // init
    async init() {
        // add event listener hashchange
        window.addEventListener("hashchange", () => {
            this._navigate(document.location.hash);
        });
        // init
        if (document.location.hash) {
            await this._navigate(document.location.hash);
        } else {
            let defaultArea = this._areas.getDefaultArea();
            document.location.hash = this._hashPrefix + defaultArea.home;
        }
    }

    // methods
    getPage() {
        return this.getPages()[0];
    }
    getPages() {
        return Array.from(this._container.querySelectorAll(":scope > x-page:not([layout='dialog'])"));
    }
    getPageByElement(target) {
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
    getHref(src, page, settings) {
        let pages = this.getPages();
        if (!settings) settings = {};
        if (typeof (settings.relative) == "undefined") settings.relative = false;
        let prefix = "";
        //absolute
        if (src.indexOf("://") != -1) return src;
        //resolve src
        src = combineUrls(page.src, src);
        //breadcrumb
        if (settings.breadcrumb) {
            src += (src.indexOf("?") != -1 ? "&" : "?") + "xshell-page-breadcrumb=" + btoa(JSON.stringify(page.breadcrumb)).replace(/\+/g, "-").replace(/\//g, "_");
        }
        //stack page
        let index = pages.indexOf(page);
        if (settings.target == "#stack") index++;
        for (var i = 0; i < index; i++) {
            prefix += this._hashPrefix + pages[i].src;
        }
        //return
        return this._config.get("app.base") + "/" + prefix + this._hashPrefix + src;
    }
    navigate(src) {
        //navigate
        window.document.location.hash = this._hashPrefix + src;
    }
    async showPage({ src, sender, target }) {
        //show page
        if (sender) {
            src = combineUrls(sender.src, src);
        }
        if (target == "#dialog") {
            //show page dialog
            return await this.showDialog({ src, sender });
        } else if (target == "#stack") {
            //show page stack
            this.showStackedPage({ src, sender });
        } else {
            //show page main
            window.document.location.hash = this._hashPrefix + src;
        }
    }
    async showStackedPage({ src }) {
        //show page stack
        window.document.location.hash += this._hashPrefix + src;
    }
    async showDialog({ src, context, sender }) {
        //show page dialog
        if (sender) {
            src = combineUrls(sender.src, src);
        }
        let resolveFunc = null;
        let page = document.createElement("x-page");
        page.setAttribute("src", src);
        page.setAttribute("layout", "dialog");
        page.context = context || {};
        page.addEventListener("close", (event) => {
            resolveFunc(event.target.result);
            if (event.target.parentNode) {
                event.target.parentNode.removeChild(event.target);
            }
        });
        this._container.appendChild(page);
        return new Promise((resolve) => {
            resolveFunc = resolve;
        });
    }

    // private methods
    async _navigate(hash) {
        //navigate
        let hashBeforeParts = (this._hash ? this._hash.split(this._hashPrefix) : []);
        let hashAfterParts = (hash ? hash.substring(this._hashPrefix.length).split(this._hashPrefix) : []);
        let inc = 0;
        //close the last dialog
        let allPages = Array.from(this._container.querySelectorAll(":scope > x-page"));
        for (let i = allPages.length - 1; i >= 0; i--) {
            let page = allPages[i];
            if (page.getAttribute("layout") != "dialog") break;
            this._container.removeChild(page);            
        }
        //process hash parts
        for (let i = 0; i < Math.max(hashBeforeParts.length, hashAfterParts.length); i++) {
            let hashBeforePart = hashBeforeParts[i];
            let hashAfterPart = hashAfterParts[i];
            if (!hashBeforePart && hashAfterPart) {
                //add page
                let page = document.createElement("x-page");
                page.setAttribute("src", hashAfterPart);
                if (i == 0) {
                    page.setAttribute("layout", "main");
                    //emit event navigation-start
                    this._bus.emit("xshell:navigation:start", { src: page.src });
                } else {
                    page.setAttribute("layout", "stack");
                    page.addEventListener("close", (event) => {
                        //page close
                        let pages = this.getPages();
                        let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                        let index = pages.indexOf(event.target);
                        hashParts = hashParts.filter((_, idx) => idx !== index);
                        document.location.hash = this._hashPrefix + hashParts.join(this._hashPrefix);
                    });
                }
                page.addEventListener("change", (event) => {
                    //page change
                    let pages = this.getPages();
                    if (pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this._config.get("app.label");
                    }
                });
                page.addEventListener("replace", (event) => {
                    //page replace
                    let pages = this.getPages();
                    let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                    let index = pages.indexOf(event.target);
                    hashParts[index] = event.target.src;
                    history.replaceState(null, "", this._hashPrefix + hashParts.join(this._hashPrefix));
                });
                page.addEventListener("load", (event) => {
                    //page load
                    let pages = this.getPages();
                    if (pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this._config.get("app.label");
                        this._bus.emit("xshell:navigation:end", { src: event.target.src });
                    }
                });
                page.addEventListener("navigate", (event) => {
                    //page navigation
                    let pages = this.getPages();
                    let index = pages.indexOf(event.target);
                    if (index != -1) {
                        let hashParts = document.location.hash.substring(this._hashPrefix.length).split(this._hashPrefix);
                        hashParts[index] = event.detail;
                        document.location.hash = this._hashPrefix + hashParts.join(this._hashPrefix);
                    }
                });
                //add page to container
                this._container.appendChild(page);
            } else if (hashBeforePart && !hashAfterPart) {
                //remove page
                let pages = this.getPages();
                let page = pages[i + inc];
                page.removePage();
                inc -= 1;
            } else if (hashBeforePart != hashAfterPart) {
                //change page
                let pages = this.getPages();
                let page = pages[i];
                page.src = hashAfterPart;
                //emit event navigation-start
                if (i == 0) {
                    this._bus.emit("xshell:navigation:start", { src: page.src });
                }
            }
        }
        this._hash = hashAfterParts.join(this._hashPrefix);
    }
}

