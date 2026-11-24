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
        stateEngine:  "proxy"
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

        /* x-app-menu */
        x-app-menu {
            position:sticky;
            top:0;
            height:100vh;
            z-index:2;
        }

        /* dock-container */
        .dock-container {flex:1; }
        .dock-container .docked-main {display:flex; }
        .dock-container .docked-main .body {flex:1;}
        .dock-container .docked-page {position:relative;}

        .dock-container x-splitter x-toolbar {transform: translateZ(90);}
        .dock-container x-splitter x-toolbar span {flex:1;}

        .dock-container.bottom {display:flex; flex-direction:column;height:100vh; overflow:hidden; height:100vh;}
        .dock-container.bottom .docked-main {overflow-y:auto;  scrollbar-width:thin; scrollbar-gutter: stable; }
        .dock-container.bottom .docked-main x-app-area-menu {position:block; height:100%;}
        .dock-container.bottom .docked-page {flex:0 0 25em; min-height:10em; overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page);}  
        .dock-container.bottom .docked-page x-page {height:100%;}

        .dock-container.right {display:flex; flex-direction:row; height:100vh; width:100vw; overflow:hidden;}
        .dock-container.right .docked-main { overflow-y:auto; scrollbar-width:thin; scrollbar-gutter: stable; flex:1;}
        .dock-container.right .docked-page {flex:0 0 25em; min-width:10em; overflow-y:auto; scrollbar-width:thin; background:var(--x-color-background-page);}  
        .dock-container.right .docked-page x-page {height:100%;}

        /* x-app-area-menu */
        x-app-area-menu {
            height:100vh; 
            position:sticky; 
            top:0; 
            bottom:0;
            overflow:auto;
            width: var(--x-layout-main-drawer-width);
            box-sizing: border-box;
            flex-shrink:0;            
            padding:1.3em;
            padding-left:2em;
            background:var(--x-layout-main-drawer-background);
            scrollbar-width:none; 
            scrollbar-gutter: stable;
        }
        x-app-area-menu:hover {
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
        .title x-page-breadcrumb {
            font-size:var(--x-font-size-small);
            transform:translateY(-1em);
            display:block;
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

        <!-- app menu -->
        <x-app-menu></x-app-menu>

        <!-- docked page -->
        <div x-attr:class="'dock-container ' + (state.dockSrc ? state.dockPosition : '')">

            <div class="docked-main" x-on:scroll="onScroll">

                <!-- x-app-area-menu -->
                <x-app-area-menu></x-app-area-menu>

                <!-- body -->
                <div x-attr:class="'body' + (state.pageClasses ? ' ' + state.pageClasses : '')">
                    <main>           
                        <div>   
                            <div class="title">
                                <div>
                                    <h1>
                                        <x-page-title></x-page-title>
                                    </h1>
                                    <x-page-breadcrumb></x-page-breadcrumb>
                                    
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
        pageClasses:     "",
        dockPosition:    "bottom",
        dockSrc:         ""
    },
    controller({ state, events, areas, bus, getPage, host, postRender, preferences }) {
        let pendingWrite = Promise.resolve();
        let dockSizeRevision = 0;
        let restoring = false;
        let menuChanged = false;
        let dockSrcChanged = false;
        let dockPositionChanged = false;
        return {
            async load(params) {
                // Start restoration while listeners can still capture newer user changes.
                const keys = ["x-layout-main.toggled", "x-layout-main.dockSrc", "x-layout-main.dockPosition"];
                const savedPromise = Promise.allSettled(keys.map(key => preferences.get(key)));
                events.on(state, "change:toggled", () => { if (!restoring) menuChanged = true; });
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
                events.on(state, ["change:dockSrc", "change:dockPosition"], (event) => {
                    if (restoring) return;
                    if (event.prop === "dockSrc") dockSrcChanged = true;
                    if (event.prop === "dockPosition") dockPositionChanged = true;
                    if (state.dockSrc) {
                        document.documentElement.setAttribute("data-scrollbar", "none");
                    } else {
                        document.documentElement.removeAttribute("data-scrollbar");
                    }
                    // Queue both changes in event order while rendering remains synchronous.
                    if (state.dockSrc) this.savePreference("x-layout-main.dockSrc", state.dockSrc);
                    else this.deletePreference("x-layout-main.dockSrc");
                    this.savePreference("x-layout-main.dockPosition", state.dockPosition);
                    postRender("restoreDockSize");
                });
                // Apply only fields that remained untouched while IndexedDB was loading.
                const saved = await savedPromise;
                restoring = true;
                try {
                    if (!dockSrcChanged) state.dockSrc = saved[1].status === "fulfilled" ? saved[1].value || "" : "";
                    if (!dockPositionChanged) state.dockPosition = saved[2].status === "fulfilled" ? saved[2].value || "bottom" : "bottom";
                    if (state.dockSrc) document.documentElement.setAttribute("data-scrollbar", "none");
                    else document.documentElement.removeAttribute("data-scrollbar");
                } finally { restoring = false; }
                if (state.dockSrc) postRender("restoreDockSize");
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
            savePreference(key, value) {
                // Keep writes ordered and absorb storage failures without blocking interaction.
                pendingWrite = pendingWrite.then(() => preferences.set(key, value)).catch(() => {});
            },
            deletePreference(key) {
                // Keep deletions ordered with adjacent dock updates.
                pendingWrite = pendingWrite.then(() => preferences.delete(key)).catch(() => {});
            },
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
                const dimension = state.dockPosition === "right" ? "width" : "height";
                const size = Math.round(panel.getBoundingClientRect()[dimension]);
                if (!Number.isFinite(size) || size <= 0) return;
                dockSizeRevision++;
                this.savePreference(`x-layout-main.dockSize.${state.dockPosition}`, String(size));
            },
            async restoreDockSize() {
                // Find the rendered dock and read the saved size for its current position.
                const panel = host.shadowRoot.querySelector(".docked-page");
                if (!panel) return;
                const position = state.dockPosition;
                const revision = ++dockSizeRevision;
                let size;
                try {
                    await pendingWrite;
                    size = Number(await preferences.get(`x-layout-main.dockSize.${position}`));
                } catch { }
                // A newer resize, position change, or render takes precedence over this read.
                if (revision !== dockSizeRevision || position !== state.dockPosition || panel !== host.shadowRoot.querySelector(".docked-page")) return;
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
        };
    }
}
