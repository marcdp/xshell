
// consts
const HASH_PREFIX = "#!";


// class
class XPageNavigatorHash extends HTMLElement {
    
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
    getPages() {
        return Array.prototype.slice.call(this.querySelectorAll(":scope > x-page:not(.dialog)"));
    }
    getRealUrl(src, page = null) {
        let prefix = "";
        if (page) {
            let pages = this.getPages();
            let index = pages.indexOf(page);
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
            page.setAttribute("dialog", "");
            page.className = "dialog";
            page.addEventListener("close", (event) => {
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
        //close dialogs if any
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
                    page.setAttribute("dialog", "");
                    page.className = "stack";
                    page.addEventListener("close", (event) => {
                        let hashParts = document.location.hash.substring(HASH_PREFIX.length).split(HASH_PREFIX);
                        let index = Array.prototype.slice.call(this.querySelectorAll(":scope > x-page:not(.dialog)")).indexOf(event.target);
                        hashParts = hashParts.filter((_, idx) => idx !== index);
                        document.location.hash = HASH_PREFIX + hashParts.join(HASH_PREFIX);                        
                    });
                }
                page.addEventListener("label-change", (event) => {
                    if (this.firstElementChild == event.target) {
                        var label = event.target.label;
                        if (label) document.title = this.config.titlePrefix + label + this.config.titleSuffix;
                    }
                });
                page.addEventListener("load", (event) => {
                    if (this.firstElementChild == event.target) {
                        var label = event.target.label;
                        if (label) document.title = this.config.titlePrefix + label + this.config.titleSuffix;
                    }
                });
                this.appendChild(page);
            } else if (hashBeforePart && !hashAfterPart) {
                //remove page
                let page = this.querySelectorAll(":scope > x-page:not(.dialog)")[i + inc];
                page.parentNode.removeChild(page);
                inc -= 1;
            } else if (hashBeforePart != hashAfterPart) {
                //change page
                let page = this.querySelectorAll(":scope > x-page:not(.dialog)")[i];
                hashBeforeParts.pop();
                this.removeChild(page);
                i--;
            }
        }
        this._hash = hashAfterParts.join(HASH_PREFIX);
    } 
    
}

//define web component
customElements.define('x-page-navigator-hash', XPageNavigatorHash);

//export 
export default XPageNavigatorHash;

