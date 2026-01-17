import Page from "../page.js";
import xshell from "../xshell.js";
import Utils from "../utils.js";


// class
class PageHtml extends Page {


    //vars
    _html = null; 
    _src = null;
    _virtual_src = null;
    _moduleUrl = null;


    //ctor
    constructor(html, src, virtual_src) {
        super();
        this._html = html;
        this._src = src;
        this._virtual_src = virtual_src;    
        this._moduleUrl = virtual_src.substring(0, virtual_src.indexOf("/", 1));
    }


    //methods
    async init(host) {
        await super.init(host);        
        // parse document
        let document = (new DOMParser()).parseFromString("<html><body>" + this._html + "</body></html>", "text/html");
        // load required web components
        let shellLazyName = xshell.config.get("xshell.lazy");
        let componentNames = [...new Set(Array.from(document.querySelectorAll('*')).filter(el => {
            if (el.tagName.includes('-')) {
                if (shellLazyName && (el.localName == shellLazyName || el.closest(shellLazyName) == null)) {
                    return true;
                }
            }
            return false;
        }).map(el => "component:" + el.tagName.toLowerCase()))];
        document.querySelectorAll('template').forEach(templateEl => {
            var componentNamesInTemplates = [...new Set(Array.from(templateEl.content.querySelectorAll('*')).filter(el => {
                if (el.tagName.includes('-')) {
                    if (shellLazyName && (el.localName == shellLazyName || el.closest(shellLazyName) == null)) {
                        return true;
                    }
                }
                return false;
            }).map(el => "component:" + el.tagName.toLowerCase()))];
            componentNames = Array.from(new Set([...componentNames, ...componentNamesInTemplates]));
        });
        // title
        if (document.title) {
            this.label = document.title
        }
        // load used components
        if (componentNames.length) {
            try {
                await xshell.loader.load(componentNames);
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
                    src: this._src
                });
                return;
            }
        }     
        // rewrite resource urls            
        Utils.rewriteDocumentUrls(document, (localName, attr, url) => {
            if (url.startsWith("xshell/")) return url;
            if (url.indexOf(":") != -1) return url;
            if (url.startsWith("/")) return xshell.resolver.resolveUrl(this._moduleUrl + url);
            if (xshell.resolver.has("import:" + url)) {
                return xshell.resolver.resolveUrl("import:" + url);
            }
            return Utils.combineUrls(this._src, url);
        });      
        // create and append scripts
        var waitForControllerRegistration = false;
        let scripts = [];
        for(let script of document.querySelectorAll("script")){
            if (!script.src) {
                let newScript = document.createElement("script");
                for (let j = 0; j < script.attributes.length; j++) {
                    newScript.setAttribute(script.attributes[j].name, script.attributes[j].value);
                }
                newScript.textContent = "window.__XSHELL__PAGE_ID = '" + this.id + "';\n" + script.textContent.trimEnd() + `\n    //# sourceURL=${this._src}`;
                host.appendChild(newScript);
                waitForControllerRegistration = true;
            }
            scripts.push(script);
        }
        // await for scripts to be ready
        if (waitForControllerRegistration) {
            await xshell.pages.waitForPageReady(this.id);
        } else {
            xshell.pages.setPageReady(this.id);
        }
        // remove old nodes except scripts
        while (host.childNodes.length > scripts.length) {
            host.removeChild(host.firstChild);    
        }
        // init command
        this.onCommand("init");
        // create html fragment
        let documentFragment = document.createDocumentFragment();
        for(let i = 0; i < document.body.childNodes.length; i++) {
            let node = document.body.childNodes[i];
            if (node.localName != "script") {
                documentFragment.appendChild(node.cloneNode(true));
            }
        };
        // add to host in one shot
        host.appendChild(documentFragment);
    }
    clone() {
        let result = new PageHtml(this._html, this._src, this._virtual_src);
        return result;
    }
}


//export 
export default class LoaderHtml {
    async load(src, virtual_src) {
        // fetch html
        let response = await fetch(src);
        if (response.ok == false) {
            throw new Error(`Failed to load page '${src}': ${response.status} ${response.statusText}`);
        }
        let html = await response.text();        
        // create page
        let page = new PageHtml(html, src, virtual_src);
        // return
        return page;
    }
};