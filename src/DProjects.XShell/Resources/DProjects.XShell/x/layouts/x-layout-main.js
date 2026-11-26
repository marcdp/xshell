import { probablyPhone, getScrollbarWidth } from "../utils/dom.js";
import { findObjectsPath } from "../utils/object.js";

// layout
export default {
    contract: {
        description: "Main layout.",
        events: {},
        properties: {},
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
        stateEngine: "proxy",
        awaitLoad: true
    },
    style:`
        :host {
            display:flex;
            flex-direction:row;
            flex:1;
            width:100%;
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


        /* dock-container */
        .dock-container {flex:1; }
        .dock-container .docked-main {display:flex; }
        .dock-container .docked-main .body {flex:1;}
        .dock-container .docked-page {position:relative;}

        .dock-container x-splitter x-toolbar {transform: translateZ(90);}
        .dock-container x-splitter x-toolbar span {flex:1;}

        .dock-container.bottom {display:flex; flex-direction:column;height:100vh; overflow:hidden; height:100vh;}
        .dock-container.bottom .docked-main {overflow-y:hidden;    }
        .dock-container.bottom .docked-main x-app-menu {position:block; height:100%;}
        .dock-container.bottom .docked-main x-page-menu {position:block; height:100%;}
        .dock-container.bottom .docked-main main {height:100%; overflow-y:auto;  scrollbar-width:thin; scrollbar-gutter: stable; }
        .dock-container.bottom .docked-page {flex:0 0 25em; min-height:10em; overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page); }  
        .dock-container.bottom .docked-page x-page {height:100%;}

        .dock-container.right {display:flex; flex-direction:row; height:100vh; width:100vw; overflow:hidden;}
        .dock-container.right .docked-main { overflow-y:auto; scrollbar-width:thin; scrollbar-gutter: stable; flex:1;}
        .dock-container.right .docked-page {flex:0 0 25em; min-width:10em; overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page);}  
        .dock-container.right .docked-page x-page {height:100%;}

        
        /* x-app-menu */
        x-app-menu {
            position:sticky;
            top:0;
            height:100vh;
            z-index:2;
        }

        /* x-page-menu */
        x-page-menu {
            height:100vh; 
            position:sticky; 
            top:0; 
            bottom:0;            
            box-sizing: border-box;
            flex-shrink:0;         
            background:var(--x-layout-main-drawer-background);
            scrollbar-width:none; 
            scrollbar-gutter: stable;
        }
        x-page-menu:hover {
            scrollbar-width:thin; 
        } 


        /* main */
        main {
            position:relative;
            box-sizing:border-box;
            padding: var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal) var(--x-layout-main-page-padding-vertical) var(--x-layout-main-page-padding-horizontal);            
            border-left:var(--x-layout-main-border);
            
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
        .title .breadcrumb {
            transform:translateY(-1em);
            display:flex;
            align-items:baseline;
        }
        .title .breadcrumb x-page-breadcrumb {
            margin-left:.5em;
            font-size:var(--x-font-size-small);
            
        }
        main:before {        
            content: '';
            display: block;
            border-right: var(--x-layout-main-border);
            border-bottom: var(--x-layout-main-border);
            width:.75em;
            height:.75em;
            background:var(--x-layout-main-header-background);
            border-radius:0 0 .75em 0;
            position: fixed;
            top: 0em;
            margin-left:-1.75em;
            z-index:10;
            corner-shape: scoop;
        }
        main:after {
            content: '';
            display: block;
            border-right: var(--x-layout-main-border);
            border-top: var(--x-layout-main-border);
            width:.75em;
            height:.75em;
            background:var(--x-layout-main-header-background);
            border-radius:0 .75em 0 0;
            position: fixed;
            bottom: 0em;
            margin-left:-1.75em;
            z-index:10;
            corner-shape: scoop;
        }

        

        /* custom */
        .no-title .title {display:none;}
        .main-no-title .title {display:none;}

        /* desktop */
        @media (min-width: 769px) {

            .docked-main {
                --x-fill-top: 0;
                --x-fill-height: 100vh;
            }
            .body {
                display:flex;
                transition:margin var(--x-transition-duration);                
            } 
            
            .body .divider {
                position:fixed; 
                top:0; 
                bottom:0;
                left: var(--x-layout-main-drawer-width);;
                transition:transform var(--x-transition-duration);
            }
            .body main { 
                flex:1;                
            }
            .body main > div {
                max-width:var(--x-layout-main-page-max-width);
                margin-left:auto; 
                margin-right:auto;
            }

            /* layout-fill */
            @media (min-width: 769px) {
                .body:is(.layout-fill, .main-layout-fill) > main {
                    max-width:unset;
                    __position:absolute;
                    __top: var(--x-fill-top);
                    __laeft:var(--x-layout-main-drawer-width); 
                    __right:0;
                    __bottom:0;
                    outline:1px red solid;
                    outline-offset: -1px;
                    padding:0;
                    display:flex;
                    transition: left var(--x-transition-duration);
                    flex-direction: column;
                    --x-layout-main-page-max-width: unset;
                    --x-layout-main-page-max-width
                }
                .body:is(.layout-fill, .main-layout-fill) main > div {
                    max-width: unset;
                    margin-left:unset;
                    margin-right:unset;
                    flex:1;
                }
            }

            @media (min-width: 769px) {
                .body.size-compact {--x-layout-main-page-max-width:28rem;}
                .body.size-narrow {--x-layout-main-page-max-width:42rem;}
                .body.size-medium {--x-layout-main-page-max-width:58rem;}
                .body.size-wide {--x-layout-main-page-max-width:75em;}
                .body.size-full {--x-layout-main-page-max-width:100%; }

                /* Layout-specific sizes win by source order. */
                .body.main-size-compact {--x-layout-main-page-max-width:28rem;}
                .body.main-size-narrow {--x-layout-main-page-max-width:42rem;}
                .body.main-size-medium {--x-layout-main-page-max-width:58rem;}
                .body.main-size-wide {--x-layout-main-page-max-width:75em;}
                .body.main-size-full {--x-layout-main-page-max-width:100%; }
            }

        }

        /* responsive */
        @media (max-width: 768px) {

            .header.shell {
                padding-left:.25em;
                padding-right:.75em;
            }
            .header .logo img {width:4em;}

            .header .spacer  {display:none}
            .header .input-dropdown {flex:1;}

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
            .body .divider {display:none;}

            }
    `,
    template: `

        <!-- loading -->
        <x-loading x-if="state.status=='loading'"></x-loading>        

        <!-- docked page -->
        <div x-attr:class="'dock-container ' + (state.dockSrc ? state.dockPosition : '')">

            <div class="docked-main" >

                <!-- app menu -->
                <x-app-menu></x-app-menu>
                
                <!-- x-page-menu -->
                <x-page-menu x-class:collapsed="state.menuCollapsed"></x-page-menu>

                <!-- body -->
                <div x-attr:class="'body' + (state.pageClasses ? ' ' + state.pageClasses : '')">
                    <main>           
                        <div>   
                            <div class="title">
                                <div>                                    
                                    <h1>
                                        <x-page-title></x-page-title>
                                    </h1>
                                    <div class="breadcrumb">
                                        <x-button class="anchor" x-attr:icon="(state.menuCollapsed ? 'x-sidebar-off' : 'x-sidebar-on')" x-on:click="onToggleMenu" ></x-button>
                                        <x-page-breadcrumb></x-page-breadcrumb>
                                    </div>
                                </div>
                                <div class="header-actions">
                                    <slot name="header-actions"></slot>
                                    <x-page-info></x-page-info>
                                </div>
                            </div>              
                            <x-page-description></x-page-description>
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
        menuCollapsed:     false,
        pageClasses:     "",
        dockPosition:    "bottom",
        dockSrc:         ""
    },
    controller({ state, events, areas, bus, getPage, host, postRender, preferences }) {
        let pendingWrite = Promise.resolve();
        let menuCollapsedChanged = false;
        let dockSrcChanged = false;
        let dockPositionChanged = false;
        let restoringProperty = null;
        let dockSizeGeneration = 0;
        return {
            async load(params) {
                // auto close menu on navigation start (mobile)
                events.on(bus, "xshell:navigation:end", "refresh");
                // bind refresh
                events.on(bus, "xshell:menus:change", "refresh")
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
                events.on(state, ["change:menuCollapsed", "change:dockSrc", "change:dockPosition"], (event) => {
                    const restoring = restoringProperty === event.prop;
                    if (!restoring && event.prop === "menuCollapsed") menuCollapsedChanged = true;
                    if (!restoring && event.prop === "dockSrc") dockSrcChanged = true;
                    if (!restoring && event.prop === "dockPosition") dockPositionChanged = true;
                    if (event.prop === "menuCollapsed") {
                        if (!restoring) this.queuePreferenceWrite(() => preferences.set("x-layout-main.menuCollapsed", state.menuCollapsed));
                        return;
                    }
                    if (state.dockSrc) {
                        document.documentElement.setAttribute("data-scrollbar", "none");
                    } else {
                        document.documentElement.removeAttribute("data-scrollbar");
                    }
                    // Persist user changes while initialization assignments remain read-only.
                    if (!restoring) {
                        if (state.dockSrc) this.queuePreferenceWrite(() => preferences.set("x-layout-main.dockSrc", state.dockSrc));
                        else this.queuePreferenceWrite(() => preferences.delete("x-layout-main.dockSrc"));
                        this.queuePreferenceWrite(() => preferences.set("x-layout-main.dockPosition", state.dockPosition));
                    }
                    postRender("restoreDockSize");
                });
                // restore settings
                const menuCollapsed = await preferences.get("x-layout-main.menuCollapsed");
                if (!menuCollapsedChanged) {
                    restoringProperty = "menuCollapsed";
                    try { state.menuCollapsed = menuCollapsed ?? false; } finally { restoringProperty = null; }
                }
                const dockSrc = await preferences.get("x-layout-main.dockSrc");
                if (!dockSrcChanged) {
                    restoringProperty = "dockSrc";
                    try { state.dockSrc = dockSrc ?? ""; } finally { restoringProperty = null; }
                }
                const dockPosition = await preferences.get("x-layout-main.dockPosition");
                if (!dockPositionChanged) {
                    restoringProperty = "dockPosition";
                    try { state.dockPosition = dockPosition ?? "bottom"; } finally { restoringProperty = null; }
                }
                if (state.dockSrc) postRender("restoreDockSize");
            },

            queuePreferenceWrite(operation) {
                // Serialize preference changes and keep storage failures from interrupting UI state.
                pendingWrite = pendingWrite.catch(() => {}).then(operation).catch(() => {});
                return pendingWrite;
            },

            async mount(params) {

                // refresh css variables
                this.refreshCssVariables();

                // refresh
                this.refresh();

                // Initialize menu and update its height on scroll and resize
                if (state.dockSrc) {
                    postRender("restoreDockSize");
                }
            },

            async refreshCssVariables() {
                // refresh CSS variables related to the layout, such as scrollbar width
                const scrollbarWidth = getScrollbarWidth();
                document.documentElement.style.setProperty('--x-scrollbar-width-pixels', `${Math.max(0,scrollbarWidth)}px`);
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
                        //show menu main 
                        state.menuNavigation = areas.getMenu("navigation")?.items || [];
                    } else {
                        // not found breadcrumb in page
                        // show menu main 
                        state.menuNavigation = areas.getMenu("navigation")?.items || [];
                        //breadcrumb
                        if (state.menuNavigation) {
                            let menuitems = findObjectsPath(state.menuNavigation, 'href', page.href);
                        }
                    }
                }
            },

            // events
            onPageLoaded({ event }) {
                // page loaded
                const page = getPage();
                if (page) {
                    state.pageClasses = page.meta?.classes?.join(" ") || "";
                }
            },
            onDockClose() {
                // dock close
                state.dockSrc = null;
            },
            onDockToggle() {
                // dock toggle
                state.dockPosition = state.dockPosition === "bottom" ? "right" : "bottom";
            },
            onDockResize({ event }) {
                // Keep menu sizing current throughout splitter changes.
                if (event.type !== "resize") return;

                // Persist the measured dock dimension only when resizing finishes.
                const panel = host.shadowRoot.querySelector(".docked-page");
                if (!panel) return;
                const position = state.dockPosition;
                const dimension = position === "right" ? "width" : "height";
                const size = Math.round(panel.getBoundingClientRect()[dimension]);
                if (!Number.isFinite(size) || size <= 0) return;
                dockSizeGeneration++;
                this.queuePreferenceWrite(() => preferences.set(`x-layout-main.dockSize.${position}`, String(size)));
            },
            async restoreDockSize() {
                // Find the rendered dock and read the saved size for its current position.
                const panel = host.shadowRoot.querySelector(".docked-page");
                if (!panel) return;
                const position = state.dockPosition;
                const generation = dockSizeGeneration;
                let size;
                try {
                    await pendingWrite;
                    size = Number(await preferences.get(`x-layout-main.dockSize.${position}`));
                } catch { }
                // A newer resize, position change, or render takes precedence over this read.
                if (generation !== dockSizeGeneration || position !== state.dockPosition || panel !== host.shadowRoot.querySelector(".docked-page")) return;
                if (!Number.isFinite(size) || size <= 0) {
                    panel.style.removeProperty("flex");
                    return;
                }

                // Clamp the dock while preserving the existing minimum size of both panes.
                const container = host.shadowRoot.querySelector(".dock-container");
                const main = host.shadowRoot.querySelector(".docked-main");
                const splitter = host.shadowRoot.querySelector("x-splitter");
                if (!container || !main) return;
                const dimension = state.dockPosition === "right" ? "width" : "height";
                const minimum = dimension === "width" ? "minWidth" : "minHeight";
                const panelMin = parseFloat(getComputedStyle(panel)[minimum]) || 0;
                const mainMin = parseFloat(getComputedStyle(main)[minimum]) || 0;
                const splitterSize = splitter?.getBoundingClientRect()[dimension] || 0;
                const maximum = container.getBoundingClientRect()[dimension] - splitterSize - mainMin;
                if (!Number.isFinite(maximum) || maximum < panelMin) {
                    panel.style.removeProperty("flex");
                    return;
                }
                panel.style.flex = `0 0 ${Math.min(Math.max(size, panelMin), maximum)}px`;
            },
            onToggleMenu() {
                state.menuCollapsed = !state.menuCollapsed;
            }
        };
    }
}
