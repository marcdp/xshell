import xshell from "./x-shell.js";

// consts
const HASH_PREFIX = "#!";


// class
class XNavigator extends HTMLElement {
    
    //attrs
    static get observedAttributes() { 
        return []; 
    }

    //fields
    _config = {};
    

    //ctor
    constructor() {
        super();
    }

    //props
    get config() {return this._config;}
    get pages() {
        let result = [];
        for(var child of this.children){
            if (child.localName == "x-page") {
                if (child.getAttribute("type") != "dialog") result.push(child);
            } else {
                result.push(child.firstChild);
            }
        }
        return result;
    }

    //methods
    async init(config) {
        this._config = config;
    }
    start() {
        window.addEventListener("hashchange", () => {
            this._hashChange();
        });
        if (document.location.hash) {
            this._hashChange();
        } else {
            document.location.hash = HASH_PREFIX + this.config.start;
        }
    }
    getRealUrl(src, page = null, includeCurrentPage = false) {
        let prefix = "";
        if (page) {
            let pages = this.pages;
            let index = pages.indexOf(page);
            if (includeCurrentPage) index++;
            for(var i = 0; i < index; i++) {
                prefix += HASH_PREFIX + pages[i].src;
            }
        }
        return this.config.base + "/" + prefix + HASH_PREFIX + src;
    }
    async showPage({url, type = ""}) {
        if (url.startsWith(HASH_PREFIX)) url =url.substring(HASH_PREFIX.length);
        if (type == "dialog") {
            //show dialog
            let resolveFunc = null;
            let page = document.createElement("x-page");
            page.setAttribute("src", url);
            page.setAttribute("type", "dialog");
            page.addEventListener("page:close", (event) => {
                resolveFunc(event.target.result);
                if (event.target.parentNode) {
                    event.target.parentNode.removeChild(event.target);
                }
            });
            this.appendChild(page);
            return new Promise((resolve) => {
                resolveFunc = resolve;
             });
        } else if (type == "stack") {
            //show stack 
            window.document.location.hash += HASH_PREFIX + url;
        } else {
            //show main page
            if (window.document.location.hash == HASH_PREFIX + url) {
                this.loadPage({url});
            } else {
                window.document.location.hash = HASH_PREFIX + url;
            }
        }
    }     

    //private methods
    _hashChange() {
        let hashBeforeParts = (this._hash ? this._hash.split(HASH_PREFIX) : []);
        let hashAfterParts =  (document.location.hash ? document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX) : []);
        let inc = 0;
        //close the last dialog
        while (this.querySelector(":scope > x-page.dialog:last-child")) {
            this.removeChild(this.lastElementChild);
        }
        //process hash parts
        for (let i = 0; i < Math.max(hashBeforeParts.length, hashAfterParts.length) ; i++) {
            let hashBeforePart = hashBeforeParts[i];
            let hashAfterPart = hashAfterParts[i];
            if (!hashBeforePart && hashAfterPart) {
                //add page
                let page = document.createElement("x-page");
                page.setAttribute("src", hashAfterPart);
                if (i > 0) {
                    page.setAttribute("type", "stack");
                    page.addEventListener("page:close", (event) => {
                        let hashParts = document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX);
                        let index = this.pages.indexOf(event.target);
                        hashParts = hashParts.filter((_, idx) => idx !== index);
                        document.location.hash = HASH_PREFIX + hashParts.join(HASH_PREFIX);                        
                    });
                } else {
                    page.setAttribute("type", "main");
                }
                page.addEventListener("page:change", (event) => {
                    if (this.pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = this.config.titlePrefix + label + this.config.titleSuffix;
                    }
                });
                page.addEventListener("page:load", (event) => {
                    if (this.pages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = this.config.titlePrefix + label + this.config.titleSuffix;
                    }
                });
                let container = this;
                //init app layout
                if (i == 0) {
                    container = this.firstChild;
                    if (!container) {
                        let appLayout = xshell.config.ui.layouts.app.main;
                        container = document.createElement(appLayout);
                        this.appendChild(container);
                    }
                }
                //add page to container
                container.appendChild(page);
            } else if (hashBeforePart && !hashAfterPart) {
                //remove page
                let page = this.pages[i + inc];
                page.parentNode.removeChild(page);
                inc -= 1;
            } else if (hashBeforePart != hashAfterPart) {
                //change page
                let page = this.pages[i];
                page.src = hashAfterPart;
            }
        }
        this._hash = hashAfterParts.join(HASH_PREFIX);
    } 
    
}

//define web component
customElements.define('x-navigator', XNavigator);

//export 
export default XNavigator;

