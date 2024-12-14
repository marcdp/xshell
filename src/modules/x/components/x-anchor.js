import shell from "shell";
import utils from "../../../utils.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-anchor", {
    style: `
        :host {flex:1; }
        :host a {display:inline; align-items:center; width:100%;}
        :host(.menuitem) {}
        :host(.menuitem) a {display:flex; padding-left:.6em; padding-right:.6em; text-decoration:none;}
    `,
    template: `
        <a tabindex="1"
            x-attr:href="state.hrefReal"
            x-on:click="click" 
            x-on:keydown.enter="click"
            x-attr:target="state.target"
            >
            <slot></slot>
        </a>
    `,
    state: {
        command: "",
        href: "",
        hrefReal: null,
        breadcrumb: false,
        target: "",
    },
    settings:{
        observedAttributes: ["href", "command", "target", "breadcrumb"]
    },
    methods: {
        onStateChanged(name) {
            if (name == "href" || name == "breadcrumb") {
                if (this._connected) this.onCommand("refresh");
            }
        },
        focus() {
            this.shadowRoot.querySelector("a").focus();
        },
        onCommand(command, args) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                if (this.state.href) {
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
                        shell.showPage({ src: src, sender: this.page, target: this.state.target });
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target == "#dialog") {
                        shell.showPage({ src: src, sender: this.page, target: this.state.target });
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target == "#root") {
                        shell.navigate( src );
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target.startsWith("#")) {
                        var targetPage = this.page.querySelector(this.state.target);
                        if (targetPage) targetPage.src = src;
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else {
                        let src = shell.getHref(this.state.href, this.page, { breadcrumb: this.state.breadcrumb });
                        window.open(src);
                    }
                } else if (this.state.href){
                    //page
                    let src = utils.combineUrls(this.page.src, this.state.href);
                    this.page.navigate(src);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
        }
    }
});
