import xshell from "x-shell";
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
        <a  tabindex="1"
            x-attr:href="state.realHref" 
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
        realHref: null,
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
                    let xshell = this.xshell;
                    if (xshell) {
                        this.state.realHref = xshell.getRealUrl(this.state.href, this.page, {breadcrumb: this.state.breadcrumb, type: this.state.target});
                    }
                } else {
                    this.state.realHref = null;
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
                    //target x-page element
                    if (this.state.target == "#stack") {
                        xshell.showPage({ url: this.state.href, target: "#stack"});
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target == "#dialog") {
                        xshell.showPage({ url: this.state.href, target: "#dialog"});
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (this.state.target.startsWith("#")) {
                        let targetId = this.state.target.substring(1);
                        var targetPage = this.ownerDocument.getElementById(targetId);
                        if (targetPage) {
                            targetPage.src = this.state.href;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                } else if (this.state.href && this.page && !this.page.target){
                    //page
                    let src = xshell.getRealUrl(this.state.href, this.page, {breadcrumb: this.state.breadcrumb, relative: true});
                    if (xshell.navigator.pages[0] == this.page) {
                        xshell.showPage({url: src});
                    } else {
                        this.page.src = src;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
            }
        }
    }
});
