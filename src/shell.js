import config from "./config.js";
import utils from "./utils.js";
import bus from "./bus.js";
import Page from "./page.js";

// constants
const HASH_PREFIX = "#!";

// class
class Shell {


    //fields
    _container = null;
    _modules = {};


    //ctor
    constructor() {
        console.log(`shell.constructor()`);
    }


    //props
    get modules() { return this._modules; }


    //methods
    async init(value) {
        //init
        let url = "";
        //defaults
        config.set({
            // app
            "app.name": "",
            "app.label": "",
            "app.version": "",
            "app.copyright": "",
            "app.logo": "",
            // page
            "pages.layout.default": "",
            "pages.layout.dialog": "",
            "pages.layout.main": "",
            "pages.layout.stack": "",
            "pages.layout.embed": "",
            // shell
            "shell.base": "",
            "shell.debug": false,
            "shell.start": "",
            "shell.container": "body",
            "shell.error": "",
            "shell.menus.main": {
                label:"",
                children:[  
                    { "label": "Home", "href": "#home", },
                    { "label": "Home2", "href": "#home2" }
                ]
            },
            "shell.lazy": ""
        }, import.meta.url);
        //load value
        if (typeof (value) == "string") {
            console.log(`shell.init('${value}') ...`);
            url = value;
            let response = await fetch(url);
            if (!response.ok) {
                console.error(`shell.init(): ${response.status} ${response.statusText}`);
                return;
            }
            value = JSON.parse(utils.stripJsonComments(await response.text()));
        } else {
            console.log(`shell.init({...}) ...`);
            url =document.location.pathname;
        }
        config.set(value, url);
        //load modules
        let modules = config.getAsObjects("modules");
        let tasks = [];
        for (let module of modules) {
            if (module.loading != "lazy") {
                tasks.push(this.loadModule(module));
            }
        }
        await Promise.all(tasks);        
    }
    async start() {
        //log
        console.log(`shell.start()`, config.config);
        //start date
        config.set({ "shell.started-at": performance.now() });
        //add event listener
        window.addEventListener("hashchange", () => {
            this._navigate(document.location.hash);
        });
        //navigate 
        this._container = document.querySelector(config.get("shell.container", "body"));
        this._container.appendChild(document.createComment("App pages "));
        if (document.location.hash) {
            await this._navigate(document.location.hash);
        } else {
            document.location.hash = HASH_PREFIX + config.get("shell.start");
        }
        
    }


    // modules
    getModuleBySrc(src) {
        //get module by src
        let modules = config.getAsObjects("modules");
        for (let module of modules) {
            if (src.startsWith(module.path + "/")) {
                return this._modules[module.name];
            }
        }
        return null;
    }
    async loadModuleBySrc(src) {
        //load module by src
        let modules = config.getAsObjects("modules");
        for (let module of modules) {
            if (src.startsWith(module.path + "/")) {
                if (module.status != "loaded") {
                    return await this.loadModule(module);
                }
                return this._modules[module.name];
            }
        }
        return null;
    }
    async loadModuleByName(name) {
        //load module by name        
        let module = config.getAsObject("modules." + name);
        if (module.status != "loaded") {
            return await this.loadModule(module);
        }
        return this._modules[module.name];
    }
    async loadModules() {
        let modules = config.getAsObjects("modules");
        let tasks = [];
        for (let module of modules) {
            if (module.status != "loaded") {
                tasks.push(this.loadModule(module));
            }
        }
        await Promise.all(tasks);
    }
    async loadModule(module) {
        //load module
        console.log(`shell.loadModule('${module.src}') ...`);
        //import
        let aModule = await import(module.src);
        //get instance
        let instance = aModule.default;
        if (!instance.config) instance.config = {};
        //get name
        let name = "";
        for (let key in instance.config) {
            if (key.startsWith("modules.")) {
                name = key.split(".")[1];
                break;
            }
        }
        if (!name) throw new Error(`Unable to load module: name not found; ${name}`);
        for(let key of ["label","icon","version","type","depends","styles","page-handler"]) {
            let configKey = "modules." + name + "." + key;
            if (typeof(instance.config[configKey]) == "undefined") {
                throw Error(`Unable to load module: config key not found; ${configKey}`);
            }
        }
        for (let key in instance.config) {
            if (key.startsWith("modules.") && !key.startsWith("modules." + name + ".")) {
                throw Error(`Unable to load module: misconfigured module config key in module '${name}'; ${key}`);
            }
        }
        //add config
        instance.config["modules." + name + ".status"] = "loaded";
        config.set(instance.config, module.src, module.path);
        delete instance.config;
        //get depends
        let depends = config.get("modules." + name + ".depends",[]);
        for (let depend of depends) {
            await this.loadModuleByName(depend);
        }
        //get styles
        let tasks = [];
        let styles = config.get("modules." + name + ".styles", []);
        for (let style of styles) {
            tasks.push(this.loadStyleSheet(style));
        }
        await Promise.all(tasks);
        //set
        instance.path = config.get("modules." + name + ".path", "");
        instance.src = module.src;
        instance.name = name;
        this._modules[name] = instance;
        //mount
        await instance.onCommand("load", module.args);
        //emit bus emit
        bus.emit("module-load", { name: module, module: instance });
        // log
        console.log(`shell.moduleLoaded()`, instance);
        //return
        return instance;
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
                //debugger;
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
        return config.get("shell.base") + "/" + prefix + HASH_PREFIX + src;
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
                    bus.emit("navigation-start", { page });
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
                page.addEventListener("load", (event) => {
                    //page load
                    let pages = this.getPages();
                    if (pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + config.get("app.label");
                        bus.emit("navigation-end", { src:event.target.src, page: event.target, module: page.module });
                        console.log(`page.ready()`);
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
                    bus.emit("navigation-start", { page });
                }
            }
        }
        this._hash = hashAfterParts.join(HASH_PREFIX);
    }
    
}

//export default instance
export default new Shell();

