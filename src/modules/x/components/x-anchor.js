import shell from "shell";
import utils from "../../../utils.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-anchor", {
    style: `
        :host {}
        :host a {display:inline; align-items:center; width:100%; }
        
        :host(.menuitem) {}
        :host(.menuitem) a {display:flex; padding-left:.6em; padding-right:.6em; text-decoration:none;}
        :host(.plain) {}
        :host(.plain) a {text-decoration:none; color:var(--x-color-text)}
        :host(.plain) a:hover {color:var(--x-color-primary);}
        :host(.plain) a:active {color:var(--x-color-primary-dark)}
        :host(.plain.selected) a {color:var(--x-color-primary);}
        :host(.plain.selected) a:hover {color:var(--x-color-primary-dark);}
        :host(.disabled) { pointer-events: none}

    `,
    template: `
        <a 
            x-attr:href="state.hrefReal"
            x-on:click="click" 
            x-on:keydown.enter="click"
            x-attr:target="state.target"
            x-attr:rel="state.rel"
            part="a"
            ><slot></slot></a>
    `,
    state: {
        command: "",
        href: "",
        hrefReal: null,
        breadcrumb: false,
        rel: null,
        target: null
    },
    methods: {
        focus() {
            this.shadowRoot.querySelector("a").focus();
        },
        onCommand(command, args) {
            if (command == "init") {
                //init
                this.state.addEventListener("change", (event) => {
                    if (event.prop == "href") this.onCommand("refresh");
                    if (event.prop == "breadcrumb") this.onCommand("refresh");
                });
                
            } else if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                if (this.page && this.state.href) {
                    this.state.hrefReal = shell.getHref(this.state.href, this.page, { breadcrumb: this.state.breadcrumb, target: this.state.target });
                } else {
                    this.state.hrefReal = null;
                }                
                
            } else if (command == "click") {
                //click
                let event = args.event;
                if (this.state.command) {
                    //command
                    this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: true}));
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                } else if (this.state.target) {
                    //target 
                    let src = utils.combineUrls(this.page.src, this.state.href);
                    if (this.state.target == "#stack") {
                        shell.showPage({ src: src, sender: this.page, target: this.state.target, breadcrumb: this.state.breadcrumb });
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target == "#dialog") {
                        shell.showPage({ src: src, sender: this.page, target: this.state.target, breadcrumb: this.state.breadcrumb });
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target == "#root") {
                        shell.navigate( src );
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target.startsWith("#")) {
                        let targetPage = this.page.querySelector(this.state.target);
                        if (!targetPage) targetPage = utils.getElementByIdRecursive(document, this.state.target.substring(1));
                        if (targetPage) targetPage.src = src;
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else {
                        let src = shell.getHref(this.state.href, this.page, { breadcrumb: this.state.breadcrumb });
                        window.open(src);
                    }
                //} else if (this.state.href == "#") {
                    //do nothing
                    //event.preventDefault();
                    //event.stopPropagation();
                    //return false;

                } else if (this.state.href){
                    //page
                    let src = utils.combineUrls(this.page.src, this.state.href);
                    if (src.startsWith("/")) {
                        this.page.navigate(src, {breadcrumb: this.state.breadcrumb});
                    } else {
                        document.location = src;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
        }
    }
});
