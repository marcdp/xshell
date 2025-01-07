import XElement from "../ui/x-element.js";
import { bus, utils } from "../../../shell.js";

// class
export default XElement.define("x-drawer-menu", {
    style: `
        :host {
            display:flex; 
            flex-direction:column; 
        }   
        nav li {list-style:none; }
        nav li x-anchor {display:block; margin-bottom:.7em;}
        nav li.divider {border-top:var(--x-layout-main-border); margin-top:1.5em; margin-bottom:1.5em; display:block;}

        nav > ul {margin:0; padding:0;}
        nav > ul > li { }
        nav > ul > li > ul {margin:0; padding:0;}
        nav > ul > li > x-anchor {font-size:var(--x-font-size-subtitle); font-weight:bold!important; display:block; margin-bottom:1.15em; }
        nav > ul > li > ul > li ul {padding-left:1.75em;}

        x-icon.new {padding-left:.25em; transform: translateY(-.1em);}
        x-anchor.selected {font-weight:600; }     

    `,
    template: `
        <nav x-if="state.menu" x-children="state.ul"></nav>
    `,
    state: {
        menu: null,
        ul: null
    },
    settings:{
        preload: ["component:x-anchor"]
    },
    methods: {
        onCommand(command) {
            if (command == "init") {
                //init
                this.bindEvent(this.state, "change:menu", () => {
                    let ul = document.createElement("UL");
                    let menu = this.state.menu;
                    if (menu) {
                        var createRecursive = function(menuitem) {
                            let li = document.createElement("LI");
                            if (menuitem.label == "-") {
                                li.className = "divider";
                            } else if (menuitem.tag) {
                                let element = document.createElement(menuitem.tag);
                                for (let key in menuitem) {
                                    if (key != "tag") {
                                        element[key] = menuitem[key];
                                    }
                                }
                                li.appendChild(element);
                            } else {
                                let a = document.createElement("x-anchor");
                                let label = document.createElement("span");
                                label.innerHTML = menuitem.label;
                                a.setAttribute("href", menuitem.href);
                                if (menuitem.target) a.setAttribute("target", menuitem.target);
                                a.appendChild(label);
                                if (menuitem.target && !menuitem.target.startsWith("#")) {
                                    let icon = document.createElement("x-icon");
                                    icon.className = "new";
                                    icon.setAttribute("icon", "x-open_in_new");   
                                    a.appendChild(icon);
                                }
                                a.className = "plain";
                                li.appendChild(a);
                                if (menuitem.children) {
                                    let ul = document.createElement("UL");
                                    for (let subMenuitem of menuitem.children) {
                                        ul.appendChild(createRecursive(subMenuitem));
                                    }
                                    li.appendChild(ul);
                                }
                            }
                            return li;
                        };
                        ul.appendChild(createRecursive(menu));
                    }
                    this.state.ul = ul;
                    this.onCommand("refresh");
                });
                this.bindEvent(bus, "navigation-end", "refresh");

            } else if (command == "refresh") {
                //refresh
                let href = this.page.src;
                if (this.page.srcPage) href = this.page.srcPage;
                if (this.state.ul) {
                    //disable
                    this.state.ul.querySelectorAll(`x-anchor.selected`).forEach( (element)=> { element.classList.remove("selected");});
                    //select all 
                    let menu = this.state.menu;
                    let menuitems = utils.findObjectsPath(menu, 'href', href);
                    if (!menuitems) {
                        //search if menu contains a menuitem without the hashpart
                        if (href.indexOf("#") != -1) { 
                             menuitems = utils.findObjectsPath(menu, 'href', href.split("#")[0]);
                        }
                    }
                    if (!menuitems) {
                        //search if menu contains a menuitem without the hashpart
                        if (href.indexOf("?") != -1) { 
                             menuitems = utils.findObjectsPath(menu, 'href', href.split("?")[0]);
                        }
                    }
                    if (!menuitems) {
                        //search in page breadcrumb for a menu item with that href
                        for(let i = this.page.breadcrumb.length - 1; i>=0 ;  i--) {
                            let menuitem = this.page.breadcrumb[i];
                            menuitems = utils.findObjectsPath(menu, 'href', menuitem.href);
                            if (menuitems) break;
                        }
                    }
                    if (menuitems) {
                        for(let menuitem of menuitems){
                            let index = menuitems.indexOf(menuitem);
                            if (index == 0 && menuitems.length > 1) continue;
                            let a = this.state.ul.querySelector(`x-anchor[href='${menuitem.href}']`);
                            if (a) a.classList.add("selected");
                        }
                    }
                }
            }
        }
    }
});

