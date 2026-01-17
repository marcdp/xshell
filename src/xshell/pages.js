import Page from "./page.js";

// class
export default class Pages {

    // vars
    _config = null;
    _definitions = new Map();
    _pages = new Map();

    // constructor
    constructor( {config}) {
        this._config = config;
    }


    // methods
    define(url, definition) {
        const appBase = this._config.get("app.base");
        const src = (url.startsWith(appBase) ? url.substring(appBase.length) : url);
        // settings
        if (!definition.settings) definition.settings = {};
        let settings = Object.freeze(Object.assign({
            preload: []            
        }, definition.settings));
        // create class
        let result = class extends Page {
            // static
            static definition = definition;
            // props
            get settings() { return settings ;}
        };
        // load template
        // ...
        // load dependencies
        // ...
        // methods
        if (definition.methods){
            for(let key in definition.methods) {
                let value = definition.methods[key];
                result.prototype[key] = value;
            }
        }
        // register
        this._definitions.set(src, result);
        // return
        return result;
    }




    // other
    registerPage(page) {
        let resolve;
        let resolved = false;
        const ready = new Promise(r => {
            resolve = () => {
                if (!resolved) {
                    resolved = true;
                    r();
                }
            };
        });
        // add ready promise
        this._pages.set(page.id, {page, resolve, ready});
    }
    unregisterPage(page) {
        this._pages.delete(page.id);
    }
    /*
    createController(controller) {
        const page = this.getPage(window.__XSHELL__PAGE_ID);
        page.controller = controller;
        this.setPageReady(page.id);
    }

    // methods
    async waitForPageReady(pageId) {
        const slot = this._pages.get(pageId);
        if (slot) {
            await slot.ready;
        }
    }
    setPageReady(pageId) {
        const slot = this._pages.get(pageId);
        if (slot) {
            slot.resolve();
        }
    }*/
    getPage(pageId) {
        const slot = this._pages.get(pageId);
        return slot ? slot.page : null;
    }
    hasPage(pageId) {
        return this._pages.has(pageId);
    }

}

