import xshell from "x-shell";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-anchor", {
    style: `
        :host {}
        :host(.menuitem) a {text-decoration:none; display:block; flex:1; display:flex;}
    `,
    template: `
        <a x-attr:href="state.realHref" x-on:click="click">
            <slot></slot>
        </a>
    `,
    state: {
        src: "",
        href: "",
        command: "",
        realHref: null,
        breadcrumb: false,
        target: "",
        type: "",
        for: ""
    },
    settings:{
        observedAttributes: ["href", "command", "target", "for", "type", "breadcrumb"]
    },
    methods: {
        onStateChanged(name) {
            if (name == "href" || name == "breadcrumb") {
                if (this._connected) this.onCommand("refresh");
            }
        },
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                let page = this.page;
                if (page) {
                    //let src = this.getSrc();
                    //src
                    let src = page.src;
                    if (this.state.href == "") {
                        src = "";
                    } else if (this.href.startsWith("/")) {
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
                    this.state.src = src;
                    //real href
                    let realHref = null;
                    if (src == "") {
                        realHref = null;
                    } else if (this.state.type == "stack") {
                        realHref = xshell.getRealUrl(src, page, true);
                    } else if (this._type == "dialog") {
                        realHref = xshell.getRealUrl(src, page, true);
                    } else {
                        realHref = xshell.getRealUrl(src, page);
                    }
                    this.state.realHref = realHref;
                    if (realHref == null) {
                        this.render();
                    }
                }

            } else if (command == "click") {
                //click
                let event = args;
                if (this.state.command) {
                    //command
                    this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: true}));
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                } else if (this.state.for) {
                    //target x-page element
                    var targetPage = this.ownerDocument.getElementById(this.state.for);
                    if (targetPage) {
                        targetPage.src = this.state.src;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                } else if (this.page && this.page.type == ""){
                    //embedded page
                    this.page.src = this.state.src;
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                } else if (this.state.type) {
                    //main
                    xshell.showPage({ url: this.state.src, type: this.state.type});
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
        }
    }
});
