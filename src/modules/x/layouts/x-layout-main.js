import xshell, { Utils } from "xshell";
import XElement from "x-element";


// class
export default XElement.define("x-layout-main", {
    style:`
        :host {
            display:block;
            min-height:100vh;
        }
        x-loading {
            position:fixed; top:0; left:0; right:0; 
            z-index:5;
        }
        .header {
            display:flex;
            align-items:center;
            padding:.45em;
            padding-left:1.2em;
            padding-right:1.5em;
            border-bottom:var(--x-layout-main-border);
            background:white;
            min-height:2.15em;
            position:relative;
        }
        .header .logo {display:block; }
        .header .logo img {display:block; width:3em; height:1.9em; object-fit:contain; border-right:var(--x-layout-main-border);}
        .header .spacer {flex:1}
        .header x-dropdown {margin-left:.5em; }
        
        .header.shell {z-index:6; padding-left:.65em;}

        .header.breadcrumb {z-index:5; padding-right:1.5em;}

        /* areas */
        .areas {color:var(--x-color-text); margin-left:.75em; margin-right:.5em; display:block;}
        .areas:hover > x-icon {color:var(--x-color-primary);}
        .areas:active > x-icon {color:var(--x-color-primary-dark);}

        /* search */
        .header .search {display:flex;}
        .header .search x-datafield {width:30em;}
        .header .search x-icon {transform:translate(.75em,.3em); position:absolute; color: var(--x-datafield-color-placeholder); position:0;}
        .header .search-button {display:none;}

        /* breadcrumb */
        .breadcrumb {position:sticky; top:0; user-select: none; flex:1;}
        
        .breadcrumb x-icon.toggle {border-radius:50%; font-size:1.225em; width:1.75em; height:1.75em; display:inline-flex; align-items:center; justify-content:center;line-height:1em; background:var(--x-color-primary); color:white; margin-right:.25em; cursor:pointer;}
        .breadcrumb x-icon.toggle:hover {background:var(--x-color-primary-dark); }
        .breadcrumb x-icon.toggle:active {background:var(--x-color-primary-x-dark)}
        
        .breadcrumb x-icon.toggle.toggled {background:none; color:var(--x-color-text)}
        .breadcrumb x-icon.toggle.toggled:hover {background:var(--x-color-xxxxx-gray); }
        .breadcrumb x-icon.toggle.toggled:active {background:var(--x-color-xxxx-gray)}

        .breadcrumb x-icon.separator {color:var(--x-color-text-x-gray); margin-left:.35em; width:1em;}
        .breadcrumb ul {margin:0; padding:0; display: flex; align-items:center; box-sizing: border-box;}
        .breadcrumb ul li {list-style:none; margin-right:.5em; display:flex; }
        .breadcrumb ul li.empty {display:none;}
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
            position:relative;
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
            
            .body {
                display:flex;
                transition:margin var(--x-transition-duration);
                --x-fill-height: calc(100vh - 6.3em);
            }
            .body.toggled {
                margin-left: calc(var(--x-layout-main-drawer-width) * -1);	
            }
            .body .menu x-button[icon='x-close'] {
                display:none;
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
                padding-left:.25em;
                padding-right:.75em;
            }
            .header .logo img {width:4em;}

            .header .search x-datafield {width:unset; flex:1;}
            .header .spacer  {display:none}
            .header .input-dropdown {flex:1;}

            .breadcrumb x-icon.toggle {background:none; color:var(--x-color-text)}
            .breadcrumb x-icon.toggle:hover {background:var(--x-color-xxxxx-gray); }
            .breadcrumb x-icon.toggle:active {background:var(--x-color-xxxx-gray)}

            .breadcrumb ul {overflow:hidden; white-space: nowrap; flex:1;}
            .breadcrumb ul li:first-child {flex-shrink:0;}
            .breadcrumb ul li {flex-shrink:1;}
            .breadcrumb x-anchor {display:inline;overflow:hidden; text-overflow: ellipsis;}
            .breadcrumb x-icon.separator {margin-left:0; margin-right:-.35em;}
            .breadcrumb ul li:last-child { flex-shrink:1; overflow:hidden;}

            .body {
                --x-fill-height: calc(100vh - 6.3em);
            }
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
        <x-loading x-if="state.status=='loading'"></x-loading>        

        <!-- shell header -->
        <nav class="header shell">

            <a class="logo" x-attr:href="state.appBase" x-if="state.appIcon">
                <img x-attr:src="state.appIcon" x-attr:title="state.appLabel">
            </a>
            
            <x-dropdown class="areas popover">
                <x-icon tabindex="1" icon="x-apps" class="size-x2"></x-icon>
                <x-page slot="dropdown" src="/pages/areas.html" loading="lazy"></x-page>
            </x-dropdown>

            <x-dropdown class="input-dropdown">
                <div class="search">
                    <x-datafield type="search" placeholder="Search" x-model="state.keyword" ></x-datafield>
                </div>
                <x-page slot="dropdown" src="/pages/search.html" loading="lazy"></x-page>
            </x-dropdown>

            <div class="spacer"></div>

            <x-dropdown class="popover left" collapse-on-click>
                <x-button x-attr:label="state.userInitials" x-attr:title="state.userName" class="round light"></x-button>
                <x-page slot="dropdown" src="/pages/identity.html" loading="lazy"></x-page>
                <x-menu slot="dropdown" x-prop:menu="state.menuProfile"></x-menu>
            </x-dropdown>

        </nav>

        <!-- breadcrumb -->
        <nav class="header breadcrumb">
            <ul x-if="state.menuMain">
                <li>
                    <x-icon icon="x-menu" x-on:click="toggle-menu" class="toggle" x-class:toggled="state.toggled"></x-icon>
                </li>
                <li x-for="item in state.breadcrumb" x-class:empty="!item.label">
                    <x-anchor x-attr:href="item.href" class="plain" x-class:selected="(item!=state.breadcrumb[state.breadcrumb.length-1])" x-class:gray="item==state.breadcrumb[state.breadcrumb.length-1]">{{ item.label }}</x-anchor>
                    <x-icon icon="x-keyboard-arrow-right" class="separator"><x-icon>
                </li>
            </ul>

            <div class="spacer"></div>

            <x-menu x-prop:menu="state.menuTools" class="horizontal"></x-menu>
            
        </nav>

        <!-- body -->
        <div class="body" x-class:toggled="state.toggled">
            <nav class="menu">
                <div>
                    <x-button class="anchor" icon="x-keyboard-arrow-left" x-on:click="toggle-menu"></x-button>
                    <x-button class="anchor" icon="x-close" x-on:click="toggle-menu"></x-button>
                    <x-menumain x-prop:menu="state.menuMain"></x-menumain>
                </div>
            </nav>
            <div class="divider"></div>
            <main>           
                <div>     
                    <h1 x-if="state.label">{{ state.label }}</h1>
                    <slot></slot>
                </div>
            </main>
        </div>

    `,
    state: {
        status: "",
        appIcon:    xshell.config.get("app.icon"),
        appLabel:   xshell.config.get("app.label"),
        appBase:    xshell.config.get("app.base"),
        userName:   "",
        userInitials: "",
        menuMain:   null,
        menuTools:  null,
        menuProfile: null,
        toggled:    false,
        breadcrumb: [],
        label:      "",
        keyword:    "",
        shellDebug: xshell.config.get("xshell.debug")
    },
    methods: {
        async onCommand(command) {
            if (command == "load") {
                //load
                this.state.toggled = xshell.settings.getItem("x-layout-main.toggled", false);
                this.state.userName = xshell.identity.name;
                this.state.userInitials =  (() => { let w = xshell.identity.name.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w.at(-1)[0] : w[0].slice(0,2)); })().toUpperCase();
                // auto close menu on navigation start (mobile)
                this.bindEvent(xshell.bus, "xshell:navigation:start", () => {
                    if (Utils.probablyPhone()){
                        if (this.state.toggled) {
                            this.state.toggled = false;
                        }
                    }
                });
                // bind refresh
                this.bindEvent(xshell.bus, "xshell:menus:changed", "refresh")
                this.bindEvent(this.page, "load", "refresh");
                // bind search
                this.bindEvent(this.state, "change:keyword", "search");

            } else if (command == "refresh") {
                //refresh
                let src = this.page.srcPage || this.page.src;
                let module = xshell.modules.resolveModuleName(src);
                let breadcrumb = this.page.breadcrumb;
                if (!module) {
                    //no module defined 
                    this.state.menuMain = null;
                    this.state.breadcrumb = [];
                    this.state.label = this.page.label;
                } else if (breadcrumb && breadcrumb.length){
                    //get module
                    let href = "";
                    for(let menuitem of breadcrumb){
                        if (menuitem.href){
                            href = menuitem.href;
                            break;
                        }
                    }
                    module = xshell.modules.resolveModuleName(href);
                    //show menu main and tools
                    this.state.menuMain = xshell.menus.get("main");
                    this.state.menuTools = xshell.menus.get("tools");
                    this.state.menuProfile = xshell.menus.get("profile");
                    //show breadcrumb
                    this.state.breadcrumb = breadcrumb;
                    //show label
                    this.state.label = this.page.label;
                } else { 
                    // not found breadcrumb in page
                    // show menu main and tools
                    this.state.menuMain = xshell.menus.get("main");
                    this.state.menuTools = xshell.menus.get("tools");
                    this.state.menuProfile = xshell.menus.get("profile");
                    //breadcrumb
                    if (this.state.menuMain) {
                        let menuitems = Utils.findObjectsPath(this.state.menuMain, 'href', src);
                        if (menuitems) {
                            this.state.breadcrumb = menuitems;
                            this.state.label = menuitems[menuitems.length -1].label;
                        } else {
                            this.state.breadcrumb = [
                                { label: this.state.menuMain.label, href: this.state.menuMain.href},
                                { label: this.page.label }
                            ];
                            this.state.label = this.page.label;
                        }
                    }
                }

            } else if (command == "menuitem-clicked") {
                //menuitem-clicked
                alert("menuitem-clicked");

            } else if (command == "toggle-menu") {
                //toggle-menu
                this.state.toggled = !this.state.toggled;
                xshell.settings.setItem("x-layout-main.toggled", this.state.toggled);

            } else if (command == "search") {
                //search
                xshell.bus.emit("xshell:search", { keyword: this.state.keyword.trim() });
            }
            
        }
    }
});
