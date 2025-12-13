import {Page, config, loader, utils, resolver} from "xshell";

// class
class HandlerMd extends Page {


    //vars
    _markdown = null; 
    _src = null;
    _virtual_src = null;


    //ctor
    constructor(markdown, src, virtual_src) {
        super();
        this._markdown = markdown;
        this._src = src;
        this._virtual_src = virtual_src;    
    }


    //methods
    async init(host) {
        await super.init(host);        
        // convert
        let marked = await import("marked");
        let html = marked.parse(this._markdown);        
        // rewrite resource urls
        let document = (new DOMParser()).parseFromString(html, "text/html");
        utils.rewriteDocumentUrls(document, (url) => {
            if (url.indexOf(":") != -1) return url;
            if (url.startsWith("/")) return resolver.resolveUrl(this._moduleUrl + url);
            return utils.combineUrls(this._src, url);
        });            
        // load required web components
        let shellLazyName = config.get("xshell.lazy");
        let componentNames = [...new Set(Array.from(document.querySelectorAll('*')).filter(el => {
            if (el.tagName.includes('-')) {
                if (shellLazyName && (el.localName == shellLazyName || el.closest(shellLazyName) == null)) {
                    return true;
                }
            }
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
                    src: this._src
                });
                return;
            }
        }            
        //add to host in one shot
        host.replaceChildren();
        //host.appendChild(...document.body.childNodes);
        host.innerHTML = document.body.innerHTML;   
    }
    
}


//export 
export default {
    load: async (src, virtual_src) => {
        // fetch markdown
        let response = await fetch(src);
        let markdown = await response.text();
        // create page
        let page = new HandlerMd(markdown, src, virtual_src);
        // return
        return page;
    }
};