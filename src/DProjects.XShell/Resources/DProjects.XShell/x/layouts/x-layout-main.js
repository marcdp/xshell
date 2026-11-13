import { probablyPhone, getScrollbarWidth } from "../utils/dom.js";
import { findObjectsPath } from "../utils/object.js";

// layout
export default {
    contract: {
        description: "Main layout.",
        events: {},
        properties: {
            status: { type:"string", default: "", attribute: true, state: true, description: "" },
            appIcon: { type: "string", default: "", state: true, description: "" },
            appLabel: { type: "string", default: "", state: true, description: "" },
            appBasePath: { type: "string", default: "", state: true, description: "" },
            toggled: { type: "boolean", default: false, state: true, description: "" },
            keyword: { type: "string", default: "", state: true, description: "" },
            shellDebug: { type: "boolean", default: false, state: true, description: "" },
        },
        methods: {},
        slots: {
            "": {
                description: "Default slot for the layout content."
            },
            "header-actions": {
                description: "Slot for header action buttons."
            }
        }
    },
    meta: {
        renderEngine: "x",
        stateEngine:  "proxy"
    },
    style:`
        :host {
            display:block;
            min-height:100vh;
            background:var(--x-color-background-page);
        }


        /* loading */
        x-loading {
            position:fixed;
            width:var(--x-loading-width);
            left:50%;
            top:var(--x-loading-top);
            transform:translateX(-50%);
            z-index:10;
        }


        /* dock */
        .dock-container .docked-page {position:relative;}

        .dock-container x-splitter x-toolbar {transform: translateZ(90);}
        .dock-container x-splitter x-toolbar span {flex:1;}

        .dock-container.bottom {display:flex; flex-direction:column;height:100vh; overflow:hidden;}
        .dock-container.bottom .docked-main {display:block; flex:1; min-height:10em; overflow-y:auto;  scrollbar-width:thin; scrollbar-gutter: stable;}
        .dock-container.bottom .docked-page {flex:0 0 25em; min-height:10em;  overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page);}  
        .dock-container.bottom .docked-page x-page {height:100%;}
        
        .dock-container.right {display:flex; flex-direction:row; height:100vh; width:100vw; }
        .dock-container.right .docked-main {display:block; flex:1; min-width:10em; overflow:auto; scrollbar-width:thin; height:100vh; }
        .dock-container.right .docked-page {flex:0 0 25em; min-width:10em; overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page);}  
        .dock-container.right .docked-page x-page {height:100%;}

        /* header */
        .header {
            display:flex;
            align-items:center;
            padding-left:1.2em;
            padding-right:1.5em;
            border-bottom:var(--x-layout-main-border);
            background:var(--x-layout-main-header-background);
            min-height:3.15em;
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

        /* shortcuts */
        .header .shortcuts {display:flex; align-items:center;}
        .header .shortcuts x-dropdown {margin:0;}
        .header .shortcuts > * {margin-left: 0.5em;}

        /* breadcrumb */
        .breadcrumb {position:sticky; top:0; user-select: none; flex:1;}
        .breadcrumb x-icon.toggle {border-radius:50%; font-size:1.225em; width:1.75em; height:1.75em; display:inline-flex; align-items:center; justify-content:center;line-height:1em; background:var(--x-color-primary); color:var(--x-color-white); margin-right:.25em; cursor:pointer; margin-right:.5em}
        .breadcrumb x-icon.toggle:hover {background:var(--x-color-primary-dark); }
        .breadcrumb x-icon.toggle:active {background:var(--x-color-primary-x-dark)}
        .breadcrumb x-icon.toggle.toggled {background:none; color:var(--x-color-text)}
        .breadcrumb x-icon.toggle.toggled:hover {background:var(--x-color-xxxxx-gray); }
        .breadcrumb x-icon.toggle.toggled:active {background:var(--x-color-xxxx-gray)}

        /* menu */
        .body .menu {
            width: var(--x-layout-main-drawer-width);
            box-sizing: border-box;
            flex-shrink:0;            
            padding:1.3em;
            padding-left:2em;
        }
        .body .menu div x-button {
            position:absolute; 
            right: 1em;
        }

        /* main */
        .body main {
            position:relative;
            box-sizing:border-box;
            padding: var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal) var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal);            
        }
        .title {display:flex}
        .title > div:first-child {flex:1; }
        .title > div h1 {
            flex:1;
            margin-top:0;
            font-size:var(--x-font-size-title);
            line-height:125%;
            font-weight:700;
        }
        .title x-page-description {
            font-size:var(--x-font-size-small);
            transform:translateY(-1.2em);
            display:block;
        }

        /* desktop */
        @media (min-width: 769px) {
            
            .docked-main {
                --x-fill-top: 6.4em;
                --x-fill-height: calc(100vh - 6.5em);
            }
            .body {
                display:flex;
                transition:margin var(--x-transition-duration);
                
            }
            .body .menu {
                position:sticky;
                top:3.2em;
                height:calc(100vh - 6.5em);
                overflow-y:auto;
                align-self: flex-start;
                z-index:1;
                background:var(--x-layout-main-drawer-background);
            }
            .body .menu {overflow:auto; scrollbar-width: none;}
            .body .menu::-webkit-scrollbar {width: 0;height: 0;}
            .body .menu:hover {scrollbar-width: thin;}
            .body .menu:hover::-webkit-scrollbar {width: 8px;height: 8px;}
            .body.toggled {
                margin-left: calc(var(--x-layout-main-drawer-width) * -1);	
            }
            .body .menu div x-button {
                right: unset;
                left:calc(var(--x-layout-main-drawer-width) - 2.5em);
            }

            .body .menu x-button[icon='x-close'] {
                display:none;
            }
            .body .divider {
                position:fixed; 
                top:0; 
                bottom:0;
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
                max-width:var(--x-layout-main-page-max-width);
                margin-left:auto; 
                margin-right:auto;
            }

            .body.fill > main {
                max-width:unset;
                position:absolute;
                top: var(--x-fill-top);
                left:var(--x-layout-main-drawer-width); 
                right:0;
                bottom:0;
                padding:0;
                display:flex;
                transition: left var(--x-transition-duration);
                flex-direction: column;
                --x-layout-main-page-max-width: unset;
                --x-layout-main-page-max-width
            }
            .body.fill.toggled > main {left:0;}
            .body.fill main > div {
                max-width: unset;
                margin-left:unset;
                margin-right:unset;
                flex:1;
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

            .body {
                --x-fill-height: calc(100vh - 6.5em);
            }
            .body .menu {
                width: 100vw;
                background:var(--x-layout-main-drawer-background);
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

        <!-- loading -->
        <x-loading x-if="state.status=='loading'"></x-loading>        

        <!-- docked page -->
        <div x-attr:class="'dock-container ' + (state.dockSrc ? state.dockPosition : '')">

            <div class="docked-main" x-on:scroll="onScroll">

                <!-- shell header -->
                <nav class="header shell">

                    <a class="logo" x-attr:href="state.appBasePath" x-if="state.appIcon">
                        <img x-attr:src="state.appIcon" x-attr:title="state.appLabel">
                    </a>
                    
                    <x-dropdown class="areas popover">
                        <x-icon tabindex="1" icon="x-apps" class="size-x2"></x-icon>
                        <x-page slot="dropdown" src="/pages/areas.js" loading="lazy"></x-page>
                    </x-dropdown>

                    <x-dropdown class="input-dropdown">
                        <div class="search">
                            <x-datafield type="search" placeholder="Search" x-model="state.keyword" autocomplete="off"></x-datafield>
                        </div>
                        <x-page slot="dropdown" src="/pages/search.js" loading="lazy"></x-page>
                    </x-dropdown>

                    <div class="spacer"></div>

                    <div class="shortcuts">

                        <x-dropdown class="tasks popover left" _collapse-on-click>
                            <x-button class="round light" icon="x-tasks" tooltip="Background tasks" x-attr:badge="state.runningTasks > 0 ? state.runningTasks : ''"></x-button>
                            <x-page slot="dropdown" src="/pages/tasks.js" loading="lazy"></x-page>
                        </x-dropdown>

                        <div x-for="menuitem in state.menuShortcuts">
                            <div x-if="menuitem.href">
                                <x-anchor x-attr:href="menuitem.href" x-attr:title="menuitem.tooltip" x-attr:open="menuitem.open" class="round light" >
                                    <x-icon x-attr:icon="menuitem.icon"></x-icon>
                                    <label>{{ menuitem.label }}</label>
                                </x-anchor>
                            </div>
                            <x-dropdown x-else x-attr:class="'popover left' + (menuitem.class ? ' ' + menuitem.class : '')"  collapse-on-click>
                                <x-button x-attr:label="menuitem.label" x-attr:icon="menuitem.icon" x-attr:title="menuitem.tooltip" class="round light"></x-button>
                                <x-menu slot="dropdown" x-prop:menu="menuitem.children"></x-menu>            
                            </x-dropdown>
                        </div>
                    </div>

                </nav>

                <!-- breadcrumb -->
                <nav class="header breadcrumb">
                    <div x-if="state.menuNavigation">
                        <x-icon icon="x-menu" x-on:click="onToggleMenu" class="toggle" x-class:toggled="state.toggled"></x-icon>
                    </div>
                    <x-page-breadcrumb></x-page-breadcrumb>

                    <div class="spacer"></div>

                    <x-menu x-prop:menu="state.menuTools" class="horizontal"></x-menu>            
                </nav>

                <!-- body -->
                <div x-attr:class="'body' + (state.pageClasses ? ' ' + state.pageClasses : '') + (state.toggled ? ' toggled' : '')">
                    <nav class="menu">
                        <div>
                            <x-button class="anchor" icon="x-close" x-on:click="onToggleMenu"></x-button>
                            <x-page-menu></x-page-menu>
                        </div>
                    </nav>
                    <div class="divider"></div>
                    <main>           
                        <div>   
                            <div class="title">
                                <div>
                                    <h1>
                                        <x-page-title></x-page-title>
                                    </h1>
                                    <x-page-description></x-page-description>                            
                                </div>
                                <div class="header-actions">
                                    <slot name="header-actions"></slot>
                                    <x-page-info></x-page-info>
                                </div>
                            </div>                                                          
                            
                            <slot></slot>
                        </div>
                    </main>
                </div>

            </div>

            <x-splitter x-if="state.dockSrc" x-on:resize="onDockResize" x-on:change="onDockResize">
                <x-toolbar>
                    <span></span>
                    <x-button x-attr:icon="state.dockPosition == 'bottom' ? 'x-toggle-panel-bottom' : 'x-toggle-panel-right'" x-on:click="onDockToggle" class="round light small"></x-button>
                </x-toolbar>
            </x-splitter>

            <div class="docked-page" x-if="state.dockSrc" >                
                <x-page x-attr:src="state.dockSrc" layout="dock" x-on:close="onDockClose" x-on:toggledock="onDockToggle"></x-page>
            </div>  

        </div>

    `,
    state: {
        menuNavigation:  null,
        menuTools:       null,
        pageClasses:     "",
        runningTasks:    0,
        dockPosition:    "bottom",
        dockSrc:         ""
    },
    controller({ state, events, areas, bus, getPage, host, tasks, commands }) {
        return {
            async load(params) {
                // toggled
                state.toggled = localStorage.getItem("xshell.toggled") == "true";
                state.dockSrc = localStorage.getItem("xshell.dockSrc") || "";
                state.dockPosition = localStorage.getItem("xshell.dockPosition") || "bottom";                
                if (state.dockSrc) document.documentElement.setAttribute("data-scrollbar", "none");
                // auto close menu on navigation start (mobile)
                events.on(bus, "xshell:navigation:start", (e) => {
                    if (probablyPhone()) {
                        if (state.toggled) {
                            state.toggled = false;
                        }
                    }
                });
                events.on(bus, "xshell:navigation:end", "refresh");
                // bind refresh
                events.on(bus, "xshell:menus:change", "refresh")
                // bind search
                events.on(state, "change:keyword", "search");
                // bind tasks change
                events.on(bus, ["xshell:tasks:added", "xshell:tasks:updated", "xshell:tasks:removed"], "refreshTasks");
                // bind page load event to update page classes
                events.on(bus, "xshell:page:load", (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.onPageLoaded({event});
                    }
                });
                // listen for dock changes
                events.on(bus, "xshell:navigation:dock:changed", (event) => {
                    state.dockSrc = event.detail.src;
                });
                events.on(state, ["change:dockSrc", "change:dockPosition"], (event) => {
                    if (state.dockSrc) {
                        document.documentElement.setAttribute("data-scrollbar", "none");
                    } else {
                        document.documentElement.removeAttribute("data-scrollbar");
                    }
                    if (state.dockSrc) {
                        localStorage.setItem("xshell.dockSrc", state.dockSrc);
                    } else {
                        localStorage.removeItem("xshell.dockSrc");
                    }
                    localStorage.setItem("xshell.dockPosition", state.dockPosition);
                    commands.enqueue("refreshMenuHeight");
                });
            },

            async mount(params) {

                // refresh css variables
                this.refreshCssVariables();

                // refresh
                this.refresh();

                // Initialize menu and update its height on scroll and resize
                window.addEventListener("scroll", () => this.refreshMenuHeight(), { passive: true });
                window.addEventListener("resize", () => this.refreshMenuHeight());
                this.refreshMenuHeight();
            },

            refreshMenuHeight() {
                const menu = host.shadowRoot.querySelector(".body > .menu");
                const dockedMain = host.shadowRoot.querySelector(".docked-main");
                if (!menu) return;
                const top = menu.getBoundingClientRect().top;
                if (state.dockSrc && state.dockPosition === "bottom") {
                    const dockedMainRect = dockedMain.getBoundingClientRect();
                    menu.style.height = `${dockedMainRect.height - top}px`;
                } else {
                    menu.style.height = `${window.innerHeight - top}px`;
                }
            },

            async refreshCssVariables() {
                // refresh CSS variables related to the layout, such as scrollbar width
                const scrollbarWidth = getScrollbarWidth();
                document.documentElement.style.setProperty('--x-scrollbar-width-pixels', `${Math.max(0,scrollbarWidth)}px`);
            },
            
            refreshTasks() {
                // refresh the count of pending and running background tasks
                const runningTasksBefore = state.runningTasks;
                state.runningTasks = tasks.list().filter(task =>
                    task.background && (task.status === "pending" || task.status === "running")
                ).length;
                if (runningTasksBefore == 0 && state.runningTasks > 0) {
                    const dropdown = host.shadowRoot.querySelector("x-dropdown.tasks");
                    dropdown.expand();
                }
            },

            async refresh(params) {
                //refresh
                const page  = getPage();
                if (page) {
                    let moduleId = page.host?.getAttribute("module");
                    if (!moduleId) {
                        //no module defined
                        state.menuNavigation = null;
                    } else if (page.breadcrumb && page.breadcrumb.length){
                        //get module
                        moduleId = page.host?.getAttribute("module");
                        //show menu main and tools
                        state.menuNavigation = areas.getMenu("navigation");
                        state.menuTools = areas.getMenu("tools");
                        state.menuShortcuts = areas.getGlobalMenu("shortcuts");
                    } else {
                        // not found breadcrumb in page
                        // show menu main and tools
                        state.menuNavigation = areas.getMenu("navigation");
                        state.menuTools = areas.getMenu("tools");
                        state.menuShortcuts = areas.getGlobalMenu("shortcuts");
                        //breadcrumb
                        if (state.menuNavigation) {
                            let menuitems = findObjectsPath(state.menuNavigation, 'href', page.href);
                        }
                    }
                }
            },

            async search(params) {
                //search
                bus.emit("xshell:search", { keyword: state.keyword.trim() });
            },

            // events
            async onToggleMenu(params) {
                //toggle-menu
                state.toggled = !state.toggled;
                localStorage.setItem("xshell.toggled", state.toggled);
            },
            onPageLoaded({ event }) {
                // page loaded
                const page = getPage();
                if (page) {
                    state.pageClasses = page.meta?.classes?.join(" ") || "";
                }
                this.refreshMenuHeight();
            },
            onDockClose() {
                // dock close
                state.dockSrc = null;
            },
            onDockToggle() {
                // dock toggle
                state.dockPosition = state.dockPosition === "bottom" ? "right" : "bottom";
            },
            onDockResize() {
                // dock resize
                this.refreshMenuHeight();
            },
            onScroll() {
                // handle scroll
                this.refreshMenuHeight();
            }

        };
    }
}
