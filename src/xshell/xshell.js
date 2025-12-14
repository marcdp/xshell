import config from "./config.js";
import utils from "./utils.js";
import bus from "./bus.js";
import loader from "./loader.js";
import Binds from "./binds.js";
import i18n from "./i18n.js";
import resolver from "./resolver.js";
import settings from "./settings.js";
import XPage from "./x-page.js";
import Page from "./page.js";


// constants
const HASH_PREFIX = "#!";

// class
class XShell {

    //fields
    _container = null;
    _listeners = [];
    _modules = [];


    //ctor
    constructor() {
        console.log(`xshell: constructor`);
    }


    //props
    get modules() { return this._modules; }


    //methods
    async init(value) {
        // init
        let url = "";
        // load value
        console.log(`xshell: init ...`);
        url = document.location.pathname;
        config.set(value, url);
        // config resolver
        for(let key of config.getKeys("resolver")) {
            resolver.addDefinition(key.substring(key.indexOf(".") + 1), config.get(key));
        }
        // init modules
        let tasks = [];
        for (let module of config.getAsObjects("modules")) {
            // load stylesheets
            let styles = config.get("modules." + module.name + ".styles", []);
            for (let style of styles) {
                let styleUrl = resolver.resolveUrl(style);
                tasks.push(this.loadStyleSheet(styleUrl));
            }
            // init module
            let instance = {
                name: module.name,
                path: "/" + module.name,
                controller: {
                    onCommand: function() {}
                }
            };
            if (module.handler) {
                tasks.push((async() => {
                    instance.controller = await loader.load("module:" + module.handler);
                })());
            }
            this._modules.push(instance);
        }
        await Promise.all(tasks);
        // add event listener
        window.addEventListener("hashchange", () => {
            this._navigate(document.location.hash);
        });
        // dispatch module-load
        tasks = [];
        for (let instance of this._modules) {
            tasks.push(instance.controller.onCommand("load", { 
                name: instance.name,
                path: instance.path,
                ... config.getAsObject("modules." + instance.name + ".params")
            }));
        }
        await Promise.all(tasks);        
        // log
        console.log(`xshell: initialized`);
        // navigate to start
        this._container = document.querySelector(config.get("xshell.container", "body"));
        this._container.appendChild(document.createComment("App pages"));
        if (document.location.hash) {
            await this._navigate(document.location.hash);
        } else {
            let startModule = config.get("xshell.start");
            let startPage = config.get("modules." + startModule + ".start", "");
            document.location.hash = HASH_PREFIX + startPage;
        }
    }

    //events
    dispatchEvent(name, args) {
        for(let listener of this._listeners){
            if (listener.name == name){
                listener.callback(args);
            }
        }
    }
    addEventListener(name, callback) {
        this._listeners.push({ name, callback });
    }
    removeEventListener(name, callback) {
        let index = 0;
        for(let listener of this._listeners){
            if (listener.name == name && listener.callback == callback){
                this._listeners.splice(index, 1);
                break;
            }
            index++;
        }
    }

    // modules
    resolveModuleName(src) {
        //get module name by src
        for (let module of this._modules) {
            if (src.startsWith(module.path + "/")) {
                return module.name;
            }
        }
        return null;
    }
    

    //styles
    async loadStyleSheet(src) {
        //load stylesheet
        let resolve = null;
        let link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", src);
        link.addEventListener("load", () => {
            resolve();
        });
        document.head.appendChild(link);
        return new Promise((resolv) => {
            resolve = resolv;
        });
    }


    //pages
    navigate(src) {
        //navigate
        window.document.location.hash = HASH_PREFIX + src;
    }
    async showPage({ src, sender, target }) {
        //show page
        if (sender) {
            src = utils.combineUrls(sender.src, src);
        }
        if (target == "#dialog") {
            //show page dialog
            return await this.showPageDialog({ src, sender });
        } else if (target == "#stack") {
            //show page stack
            this.showPageStack({ src, sender });
        } else {
            //show page main
            window.document.location.hash = HASH_PREFIX + src;
        }
    }
    async showPageStack({ src }) {
        //show page stack
        window.document.location.hash += HASH_PREFIX + src;
    }
    async showPageDialog({ src, sender }) {
        //show page dialog
        if (sender) {
            src = utils.combineUrls(sender.src, src);
        }
        let resolveFunc = null;
        let page = document.createElement("x-page");
        page.setAttribute("src", src);
        page.setAttribute("layout", "dialog");
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
        src = utils.combineUrls(page.src, src);
        //breadcrumb
        if (settings.breadcrumb) {
            src += (src.indexOf("?") != -1 ? "&" : "?") + "page-breadcrumb=" + btoa(JSON.stringify(page.breadcrumb)).replace(/\+/g, "-").replace(/\//g, "_");
        }
        //stack page
        let index = pages.indexOf(page);
        if (settings.target == "#stack") index++;
        for (var i = 0; i < index; i++) {
            prefix += HASH_PREFIX + pages[i].src;
        }
        //return
        return config.get("app.base") + "/" + prefix + HASH_PREFIX + src;
    }
    search(keyword) {
        this.dispatchEvent("search", { keyword });
    }
    

    //private
    async _navigate(hash) {
        //navigate
        let hashBeforeParts = (this._hash ? this._hash.split(HASH_PREFIX) : []);
        let hashAfterParts = (hash ? hash.substring(HASH_PREFIX.length).split(HASH_PREFIX) : []);
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
                    this.dispatchEvent("navigation-start", { page });
                } else {
                    page.setAttribute("layout", "stack");
                    page.addEventListener("close", (event) => {
                        //page close
                        let pages = this.getPages();
                        let hashParts = document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX);
                        let index = pages.indexOf(event.target);
                        hashParts = hashParts.filter((_, idx) => idx !== index);
                        document.location.hash = HASH_PREFIX + hashParts.join(HASH_PREFIX);
                    });
                }
                page.addEventListener("change", (event) => {
                    //page change
                    let pages = this.getPages();
                    if (pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + config.get("app.label");
                    }
                });
                page.addEventListener("replace", (event) => {
                    //page replace
                    let pages = this.getPages();
                    let hashParts = document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX);
                    let index = pages.indexOf(event.target);
                    hashParts[index] = event.target.src;
                    history.replaceState(null, "", HASH_PREFIX + hashParts.join(HASH_PREFIX));
                });
                page.addEventListener("load", (event) => {
                    //page load
                    let pages = this.getPages();
                    if (pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + config.get("app.label");
                        this.dispatchEvent("navigation-end", { page: event.target });
                        console.log(`page: ready`);
                    }
                });
                page.addEventListener("navigate", (event) => {
                    //page navigation
                    let pages = this.getPages();
                    let index = pages.indexOf(event.target);
                    if (index != -1) {
                        let hashParts = document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX);
                        hashParts[index] = event.detail;
                        document.location.hash = HASH_PREFIX + hashParts.join(HASH_PREFIX);
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
                    this.dispatchEvent("navigation-start", { page });
                }
            }
        }
        this._hash = hashAfterParts.join(HASH_PREFIX);
    }
    
}

//creates a new instance
let xshell = new XShell();
window.xshell = xshell;

//export default instance
export default xshell;

//export other objects and classes
export { config, bus, utils, loader, i18n, resolver, settings, Binds, XPage, Page };
