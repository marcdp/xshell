import xshell from "x-shell";
import XElement from "../ui/x-element.js";

/*
// class
export default XElement.define("x-anchor", {
    style: `
        :host {display:block;}
    `,
    template: `
        <a x-attr:href="state.ahref" x-on:click="click">
            <slot></slot>
        </a>
    `,
    state: {
        href: "",
        ahref: "#",
        breadcrumb: false,
        target: "",
        type: "",
        page: ""
    },
    settings:{
        observedAttributes: ["href", "target", "type", "breadcrumb"]
    },
    methods: {
        getSrc() {
            let page = this.page;
            debugger
            if (!page) return null;
            //compute url relative to base
            let src = page.src;
            if (this.href.startsWith("/")) {
                src = this.href;
            } else {
                if (src.indexOf("?")!=-1) src = src.substring(0, src.indexOf("?"));
                if (src.indexOf("/")!=-1) {
                    src = src.substring(0, src.lastIndexOf("/"));
                }
                src += "/" + this.href;
            }
            //breadcrumb
            if (this.breadcrumb) {
                let breadcrumb = [];
                for(let item in page.breadcrumb) {
                    breadcrumb.push(item);
                }
                breadcrumb.push({label: page.label + "xxxx", href: page.src});
                src += (src.indexOf("?")!=-1 ? "&" : "?") + "x-breadcrumb=" + btoa(JSON.stringify(breadcrumb)).replace(/\+/g,"-").replace(/\//g,"_");
            }
        },
        onStateChanged(name, oldValue, newValue) {
            if (name == "href") {
                let page = this.page;
                let src = this.getSrc();
                let href = "";
                if (this.state.type == "stack") {
                    href = xshell.getRealUrl(src, page, true);
                } else if (this._type == "dialog") {
                    href = xshell.getRealUrl(src, page, true);
                } else {
                    href = xshell.getRealUrl(src, page);
                }
                this.state.ahref = href;
                //let a = this.shadowRoot.firstChild;
                //a.setAttribute("href", href);
                //if (this.target) {
                //    a.setAttribute("target", this.target);
                //} else{
                //    a.removeAttribute("target");
                //}
                //debugger
            }
        },
        onCommand(command){
            if (command == "load") {
                //load

            } else if (command == "click") {
                //click
                debugger;
            }
        }
    }
});
*/


// class
class XAnchor extends HTMLElement {
    
    //static
    static get observedAttributes() { 
        return ["href", "target", "type", "breadcrumb", "page"]; 
    }

    //fields
    _connected = false;
    _href = "";
    _breadcrumb = false;
    _target = "";
    _type = "";
    _page = "";

    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<a href='#'><slot></slot></a>`;
        this.shadowRoot.querySelector("a").addEventListener("click", (event) => {
            let page = xshell.getPage(this);
            if (this._page) {
                //target x-page element
                var targetPage = this.ownerDocument.getElementById(this._page);
                if (targetPage) {
                    targetPage.src = this.getSrc();
                }
                event.preventDefault();
            } else if (page.type == ""){
                //embedded page
                let src = this.getSrc();
                page.src = src;
                event.preventDefault();
            } else if (this._type) {
                //main
                let src = this.getSrc();
                xshell.showPage({ url: src, type: this._type});
                event.preventDefault();
            }
        });
    }

    //props
    get href() {return this._href;}
    set href(value) {
        var changed = (this._href != value);
        this._href = value; 
        if (changed && this._connected) this.render();
    }
    get type() {return this._type;}
    set type(value) {
        var changed = (this._type != value);
        this._type = value; 
        if (changed && this._connected) this.render();
    }
    get breadcrumb() {return this._breadcrumb;}
    set breadcrumb(value) {
        var changed = (this._breadcrumb != value);
        this._breadcrumb = value; 
        if (changed && this._connected) this.render();
    }
    get target() {return this._target;}
    set target(value) {
        var changed = (this._target != value);
        this._target = value; 
        if (changed && this._connected) this.render();
    }
    get page() {return this._page;}
    set page(value) {
        var changed = (this._page != value);
        this._page = value; 
        if (changed && this._connected) this.render();
    }
    

    //methods
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "href") this.href = newValue;
        if (name == "target") this.target = newValue;
        if (name == "type") this.type = newValue;
        if (name == "page") this.page = newValue;
        if (name == "breadcrumb") this.breadcrumb = (newValue != null);
    }
    connectedCallback(){
        this._connected = true;
        this.render();
    }
    getSrc() {
        let page = xshell.getPage(this);
        //compute url relative to base
        let src = page.src;
        if (this.href.startsWith("/")) {
            src = this.href;
        } else {
            if (src.indexOf("?")!=-1) src = src.substring(0, src.indexOf("?"));
            if (src.indexOf("/")!=-1) {
                src = src.substring(0, src.lastIndexOf("/"));
            }
            src += "/" + this.href;
        }
        //breadcrumb
        if (this.breadcrumb) {
            let breadcrumb = [];
            for(let item in page.breadcrumb) {
                breadcrumb.push(item);
            }
            breadcrumb.push({label: page.label + "xxxx", href: page.src});
            src += (src.indexOf("?")!=-1 ? "&" : "?") + "x-breadcrumb=" + btoa(JSON.stringify(breadcrumb)).replace(/\+/g,"-").replace(/\//g,"_");
        }
        return src;
    }
    render() {
        let page = xshell.getPage(this);
        if (page) {
            let src = this.getSrc();
            let href = "";
            if (this._type == "stack") {
                href = xshell.getRealUrl(src, page, true);
            } else if (this._type == "dialog") {
                href = xshell.getRealUrl(src, page, true);
            } else {
                href = xshell.getRealUrl(src, page);
            }
            let a = this.shadowRoot.firstChild;
            a.setAttribute("href", href);
            if (this.target) {
                a.setAttribute("target", this.target);
            } else{
                a.removeAttribute("target");
            }
        }
    }


}


//define web component
customElements.define('x-anchor', XAnchor);

//export 
export default XAnchor;

