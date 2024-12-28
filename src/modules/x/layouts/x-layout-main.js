import config from "../../../config.js";
import bus from "../../../bus.js";
import shell from "../../../shell.js";
import utils from "../../../utils.js";
import XElement from "../../x/ui/x-element.js";


// class
export default XElement.define("x-layout-main", {
    style:`
        :host {
            display:block;
        }
        x-loading-bar {
            position:fixed; top:0; left:0; right:0; 
            z-index:5;
        }
        .header {
            display:flex;
            align-items:center;
            padding:.45em;
            padding-left:1.2em;
            padding-right:1.2em;
            border-bottom:var(--x-layout-main-border);
            background:white;
            min-height:2.15em;
            position:relative;
        }
        .header .logo {display:block;}
        .header .logo img {display:block; width:3em; height:1.9em; object-fit:contain; border-right:var(--x-layout-main-border);}
        .header .spacer {flex:1}
        
        .header.shell {z-index:2;}

        .header.breadcrumb {z-index:1;}

        /* modules */
        .modules {color:var(--x-color-text); margin-left:.75em; margin-right:.5em; display:block;}
        .modules:hover > x-icon {color:var(--x-color-primary);}
        .modules:active > x-icon {color:var(--x-color-primary-dark);}

        /* search */
        .header .search {
            display:flex;
        }
        .header .search input {
            border: var(--x-datafield-border); 
            width:30em; 
            line-height:1.725em; 
            border-radius:var(--x-datafield-border-radius); 
            padding-left:2.25em; 
            cursor:pointer; 
            font-size:var(--x-datafield-font-size);
            font-family:var(--x-datafield-font-family);
            color:var(--x-datafield-color);
            position:1;
        }
        .header .search input::placeholder {
            color: var(--x-datafield-color-placeholder);
        }
        .header .search input:focus + x-icon {color:var(--x-color-text)}
        .header .search x-icon {transform:translate(.75em,.3em); position:absolute; color: var(--x-datafield-color-placeholder); position:0;}
        .header .search-button {display:none;}

        /* breadcrumb */
        .breadcrumb {position:sticky; top:0; user-select: none; flex:1;}
        
        .breadcrumb x-icon.toggle {border-radius:50%; font-size:1.225em; width:1.75em; height:1.75em; display:inline-flex; align-items:center; justify-content:center;line-height:1.1em; background:var(--x-color-primary); color:white; margin-right:.25em; cursor:pointer;}
        .breadcrumb x-icon.toggle:hover {background:var(--x-color-primary-dark); }
        .breadcrumb x-icon.toggle:active {background:var(--x-color-primary-x-dark)}
        
        .breadcrumb x-icon.toggle.toggled {background:none; color:var(--x-color-text)}
        .breadcrumb x-icon.toggle.toggled:hover {background:var(--x-color-xxxxx-gray); }
        .breadcrumb x-icon.toggle.toggled:active {background:var(--x-color-xxxx-gray)}

        .breadcrumb x-icon.separator {color:var(--x-color-text-x-gray); margin-left:.35em; width:1em;}
        .breadcrumb ul {margin:0; padding:0; display: flex; align-items:center; box-sizing: border-box;}
        .breadcrumb ul li {list-style:none; margin-right:.5em; display:flex; }
        .breadcrumb ul li x-anchor {position:relative; font-weight:500; }
        .breadcrumb ul li x-anchor.selected:after {content:""; border-bottom:.1em var(--x-color-primary) solid; bottom:.1em; left:0; right:0; position:absolute;}
        
        .breadcrumb ul li:last-child {flex:1;}
        .breadcrumb ul li:last-child x-icon.separator {visibility:hidden}

        
        /* menu */
        .body .menu {
            width: var(--x-layout-main-drawer-width);
            box-sizing: border-box;
            flex-shrink:0;            
            padding:1.3em;
            padding-left:2em;
        }
        .body .menu div {
            top:4em; 
            position: sticky;
            box-sizing: border-box;
        }
        .body .menu div x-button {
            position:absolute; 
            right:0
        }

        /* main */
        .body main {
            box-sizing:border-box;
            padding: var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal) var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal);
        }
        .body main h1 {
            margin-top:0;
            font-size:var(--x-font-size-title);
            line-height:125%;
            font-weight:700;
        }        


        /* desktop */
        @media (min-width: 769px) {
            
            .body .menu x-button[icon='x-close'] {
                display:none;
            }
            .body {
                display:flex;
                transition:margin var(--x-transition-duration);
            }
            .body.toggled {
                margin-left: calc(var(--x-layout-main-drawer-width) * -1);	
            }
            .body .divider {
                border-left: var(--x-layout-main-border);
                position:fixed; top:0; bottom:0;
                left: var(--x-layout-main-drawer-width);;
                transition:transform var(--x-transition-duration);
            }
            .body.toggled .divider {
                transform: translateX(calc(var(--x-layout-main-drawer-width) * -1));	
            }
            .body main {
                flex:1;
                
            }
            .body main > div {
                max-width:100em;
                margin-left:auto; 
                margin-right:auto;
            }
        }

        /* responsive */
        @media (max-width: 768px) {

            .header.shell {
                padding-left:.25em                
            }
            .header .logo img {width:4em;}
            .header .search {display:none}
            .header .search-button {display:block; float:right;}
            

            .breadcrumb x-icon.toggle {background:none; color:var(--x-color-text)}
            .breadcrumb x-icon.toggle:hover {background:var(--x-color-xxxxx-gray); }
            .breadcrumb x-icon.toggle:active {background:var(--x-color-xxxx-gray)}

            .breadcrumb ul {overflow:hidden; white-space: nowrap;}
            .breadcrumb ul li:first-child {flex-shrink:0;}
            .breadcrumb ul li {flex-shrink:1;}
            .breadcrumb x-anchor {display:inline;overflow:hidden; text-overflow: ellipsis;}
            .breadcrumb x-icon.separator {margin-left:0; margin-right:-.35em;}
            .breadcrumb ul li:last-child { flex-shrink:1; overflow:hidden;}

            .body .menu {
                width: 100vw;
                background:var(--x-color-white);
                position:fixed;
                top:0em; 
                
                bottom:0;    
                transform:translateX(-100vw);
                transition:transform var(--x-transition-duration);
                border-right: var(--x-layout-main-border);
                z-index:10;
                padding: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);
            }
            .body .menu div {
                top:0; position:unset;
            }
            .body .menu div x-button {
                right:var(--x-layout-stack-page-padding-horizontal);
                top:calc(var(--x-layout-stack-page-padding-vertical) + .1em);
            }
            .body .menu x-button:not([icon='x-close']) {
                display:none;
            }
            .body.toggled .menu {
                transform:translateX(0);
                overflow-y:auto;
            }
            .body .divider {display:none;}

            }
    `,
    template: `
        <x-loading-bar x-if="state.status=='loading'"></x-loading-bar>

        <!-- shell header -->
        <nav class="header shell">
            <a class="logo" x-attr:href="state.shellBase">
                <img x-attr:src="state.appLogo" x-attr:title="state.appLabel">
            </a>
            
            <x-dropdown class="modules popover">
                <x-icon tabindex="0" icon="x-apps" class="size-x2"></x-icon>
                <x-page slot="dropdown" src="/x/pages/modules.html" loading="lazy"></x-page>
            </x-dropdown>

            <x-dropdown class="input-dropdown">
                <div class="search">
                    <input type="text" placeholder="Search">
                    <x-icon icon="x-search"></x-icon>
                </div>
                <x-page slot="dropdown" src="/x/pages/search.html" loading="lazy"></x-page>
            </x-dropdown>

            <div class="spacer"></div>

            <x-anchor class="search-button plain" href="/x/pages/search.html" target="#stack">
                <x-icon class="size-x2" icon="x-search"></x-icon>
            </x-anchor>


        </nav>

        <!-- breadcrumb -->
        <nav class="header breadcrumb">
            <ul x-if="state.menu">
                <li>
                    <x-icon icon="x-menu" x-on:click="toggle-menu" x-attr:class="(state.toggled ? 'toggle toggled' : 'toggle')"></x-icon>
                </li>
                <li x-for="item in state.breadcrumb">
                    <x-anchor x-attr:href="item.href" x-attr:class="'plain ' + (item!=state.breadcrumb[state.breadcrumb.length-1] ? 'selected' : 'gray')">{{ item.label }}</x-anchor>
                    <x-icon icon="x-keyboard-arrow-right" class="separator"><x-icon>                    
                </li>
            </ul>

            <div class="spacer"></div>

            <x-dropdown class="modules popover left" collapse-on-click>
                <x-icon tabindex="0" icon="x-debug" class="size-x2"></x-icon>
                <x-page slot="dropdown" src="/x/pages/debug.html" loading="lazy"></x-page>
            </x-dropdown>
        </nav>

        <!-- body -->
        <div x-attr:class="(state.toggled ? 'body toggled' : 'body')">
            <nav class="menu">
                <div>
                    <x-button class="anchor" icon="x-keyboard-arrow-left" x-on:click="toggle-menu"></x-button>
                    <x-button class="anchor" icon="x-close" x-on:click="toggle-menu"></x-button>
                    <x-drawer-menu x-prop:menu="state.menu"></x-drawer-menu>
                </div>
            </nav>
            <div class="divider"></div>
            <main>           
                <div>     
                    <h1>{{ state.label }}</h1>
                    <slot></slot>
                </div>
            </main>
        </div>

    `,
    state: {
        status: "",
        appLogo:    config.get("app.logo"),
        appLabel:   config.get("app.label"),
        shellBase:  config.get("shell.base"),
        shellMenu:  config.get("shell.menus.main"),
        menu:       null,
        toggled:    false,
        breadcrumb: [],
        label:      ""
    },
    //settings: {
    //    observedAttributes: ["status"]
    //},
    methods: {
        async onCommand(command, args) {
            if (command == "load") {
                //load
                this.bindEvent(bus, "navigation-start", () => {
                    if (utils.probablyPhone()){
                        if (this.state.toggled) {
                            this.state.toggled = false;
                        }
                    }
                });
                this.bindEvent(bus, "navigation-end", (event) => {
                    let href = event.src;
                    if (this.state.ul){
                        let a = this.state.ul.querySelector(`x-anchor[href='${href}']`);
                        a.classList.add("selected");
                    }
                });
                this.bindEvent(this.page, "load", "refresh");

            } else if (command == "refresh") {
                //refresh
                let breadcrumb = this.page.breadcrumb;
                if (breadcrumb && breadcrumb.length){
                    //get module
                    let href = "";
                    for(let menuitem of breadcrumb){
                        if (menuitem.href){
                            href = menuitem.href;
                            break;
                        }
                    }
                    let module = await shell.loadModuleBySrc(href);
                    //show menu
                    let menu = config.get(`modules.${module.name}.menus.main`);
                    this.state.menu = menu;
                    //show breadcrumb
                    this.state.breadcrumb = breadcrumb;
                    this.state.label = this.page.label;
                } else {
                    //get module
                    let menu = config.get(`modules.${this.page.module}.menus.main`);
                    this.state.menu = menu;
                    //breadcrumb
                    let page = this.page;
                    let menuitems = utils.findObjectsPath(menu, 'href', page.src);
                    if (menuitems) {
                        this.state.breadcrumb = menuitems;
                        this.state.label = menuitems[menuitems.length -1].label;
                    } else {
                        this.state.breadcrumb = [
                            { label: menu.label, href: menu.href}
                        ];
                        this.state.label = this.page.label;
                    }
                }

            } else if (command == "menuitem-clicked") {
                //menuitem-clicked
                alert("menuitem-clicked");

            } else if (command == "toggle-menu") {
                //toggle-menu
                this.state.toggled = !this.state.toggled;

            }
            
        }
    }
});
