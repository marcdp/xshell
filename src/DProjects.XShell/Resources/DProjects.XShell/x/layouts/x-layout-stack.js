import { getDeepActiveElement } from "../utils/dom.js";
import { mergeLayoutClasses } from "../utils/layout-classes.js";

// layout
export default {
    contract: {
        description: "Layout for a default page.",
        events: {},
        properties: {
            expanded: { type: "boolean", default: false, attribute: true, state: true, description: "" },
            status: { type: "string", default: "", attribute: true, state: true, description: "" },
            stackClasses: { type: "array", default: [], state: true, description: "Caller-supplied classes for the stacked Page." },
        },
        methods: {},
        slots: {
            "": {
                description: "Default slot for the layout content."
            },
            "header-actions": {
                description: "Slot for the layout header."
            }
        }
    },
    meta: {
        renderEngine: "x",
        stateEngine: "proxy"
    },
    style:`
        x-loading {
            position:fixed;
            width:var(--x-loading-width);
            left:50%;
            top:var(--x-loading-top);
            transform:translateX(-50%);
            z-index:10;
        }
        div.backdrop {
            position:fixed; 
            top:0;
            left:0;
            right: 0;
            bottom:0;
            z-index:7;
            transition: background var(--x-transition-duration) ease;
        }
        div.backdrop.expanded {
            background: var(--x-layout-stack-backdrop);
        }
        div.panel {
            background:var(--x-layout-stack-background);
            position:fixed;
            top:0;
            bottom:0;
            right: 0;
            width:80vw;
            overflow:auto;
            scrollbar-width: var(--x-scrollbar-width);
            scrollbar-gutter: var(--x-scrollbar-gutter);
            width:var(--x-layout-stack-width);
            max-width:100vw;
            height: unset;
            margin-right:0;
            outline:var(--x-layout-stack-border);
            max-height:unset; 
            padding:0;
            border-radius:var(--x-layout-stack-border-radius);
            box-shadow: var(--x-layout-stack-shadow);
            opacity:1;
            transform:translateX(100%);
            transition:transform var(--x-transition-duration) ease-out, opacity var(--x-transition-duration) ease-out;
            z-index:10;
        }
        div.panel.expanded {
            transform:translateX(0);
            opacity:1;
            transition:transform var(--x-transition-duration) ease, opacity var(--x-transition-duration) ease;
        }

        div.panel .header {
            padding: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);
            display:flex; 
            align-items:center;
        }
        div.panel .header > x-button:first-child {margin-right:1em; margin-left:-1em;}
        div.panel .header div.title {margin-right:1.5em;}
        div.panel .header div.title h2 {margin:0; font-size: var(--x-font-size-subtitle); }
        div.panel .header div.title h2 ~ x-page-description {font-size:var(--x-font-size-x-small);display:block;}
        div.panel .header .header-actions {display:flex; flex:1; justify-content:start; padding-right:.25em;}
        div.panel .header x-button {}

        div.panel .body {padding:0em var(--x-layout-stack-page-padding-horizontal);}    
        div.panel .body:focus {outline:none;}
        
        @media (min-width: 769px) {
            :host {
                --x-fill-top: 5em;
                --x-fill-height: calc(100vh - var(--x-fill-top));
            }
            div.panel .header div.title {display:flex; flex-direction:column; justify-content:center; min-height:3em;}
            div.panel .header div.title h2 {flex:0;}
            div.panel .body.layout-fill {display:flex; flex-direction: column; width:100%; position:absolute; top:var(--x-fill-top); height:var(--x-fill-height); box-sizing:border-box; padding:0;}
            div.panel:has(.body.layout-fill) {scrollbar-width: none; scrollbar-gutter: none; overflow:hidden;}           

            /* Explicit sizes override the width inherited from the Page's stack position. */
            div.panel:has(> .body.size-compact) {--x-layout-stack-width:clamp(22rem, 25vw, 34rem);}
            div.panel:has(> .body.size-narrow) {--x-layout-stack-width:clamp(28rem, 40vw, 46rem);}
            div.panel:has(> .body.size-medium) {--x-layout-stack-width:60vw;}
            div.panel:has(> .body.size-wide) {--x-layout-stack-width:75vw;}
            div.panel:has(> .body.size-full) {--x-layout-stack-width:100vw; border-radius:0; border:none;}
            
        }
        @media (max-width: 768px) {
            :host {
                --x-layout-stack-width:100vw;
                --x-layout-stack-border-radius: 0;
                --x-layout-stack-shadow: none;
                --x-layout-stack-border: none;

                --x-fill-top: 5em;
                --x-fill-height: calc(100vh - var(--x-fill-top));
            }
            
            div.panel .body {padding-top:1.4em;}    
            div.panel .body.layout-fill {display:flex; flex-direction: column; width:100%; position:absolute; top:var(--x-fill-top); height:var(--x-fill-height); box-sizing:border-box;padding:0;}
            div.panel:has(.body.layout-fill) {scrollbar-width: none; scrollbar-gutter: none; overflow:hidden;}
        }

        
    `,
    template: `
        <div class="backdrop" x-class:expanded="state.expanded" x-on:click="queryClose"></div>
        <div class="panel"    x-class:expanded="state.expanded" x-on:transitionend="onTransitionEnd" x-on:keydown="onKeydown">
            <x-loading x-if="state.status=='loading'"></x-loading>
            <div class="header">            
                <x-button class="light round" icon="x-arrow-back" x-on:click="queryClose"></x-button>               
                <div class="title">
                    <h2><x-page-title></x-page-title></h2>
                    <x-page-description></x-page-description>
                    
                </div>
                <div class="header-actions">
                    <slot name="header-actions"></slot>
                </div>
                <x-page-info></x-page-info>
            </div>            
            <div x-attr:class="'body' + (state.pageClasses ? ' ' + state.pageClasses : '')" tabIndex="1">
                <slot></slot>
            </div>
        </div>
    `,
    state: {
        pageClasses: null
    },
    controller({ state, events, runtime, host, postRender, getPage }) {
        let resolveClose = null;
        let previousFocus = null;
        return {
            load() {
                //load
                if (runtime.uptimeMs < 500) {
                    state.expanded = true;
                } else {
                    setTimeout(() => {
                        state.expanded = true;
                        postRender("focus");
                    }, 50);
                }
            },
            mount() {
                // Seed caller classes on mount and add Page defaults after the Page host commits its load.
                previousFocus = getDeepActiveElement();
                const pageHost = host.getRootNode().host;
                if (pageHost) events.on(pageHost, "load", "refreshClasses");
                this.refreshClasses();
            },
            unmount() {
                // Release the Page host listener for this mount.
                events.dispose();
            },
            stateChange({ changes }) {
                // History can update presentation while the same Page stays mounted.
                if (changes.some(change => change.prop === "stackClasses")) this.refreshClasses();
            },
            refreshClasses() {
                // Merge the loaded Page defaults with the current stack entry.
                state.pageClasses = mergeLayoutClasses(getPage()?.meta?.classes, state.stackClasses, "body");
            },
            focus() {
                // focus the body element within the shadow DOM, if not already focused
                const hasFocus = host.matches(':focus-within');
                if (!hasFocus) host.shadowRoot.querySelector(".body")?.focus();
            },
            queryClose() {
                //query close (send event to host, informing the a page close has been requested)
                host.dispatchEvent(new CustomEvent("queryClose", { composed: true }));
            },

            async close() {
                // Create the Promise before triggering the transition
                const transitionCompleted = new Promise(resolve => {
                    resolveClose = resolve;
                });

                // expand
                state.expanded = false;

                // try restore previous focus
                if (previousFocus?.isConnected) {
                    previousFocus.focus({ preventScroll: true });
                }
                previousFocus = null;

                // Wait until transitionEnd resolves the Promise
                await transitionCompleted;

            },  

            onKeydown({ event }) {
                // keydown handler for the panel
                if (event.key === "Escape" && !(event.defaultPrevented || event.isComposing) && state.expanded) {
                    this.queryClose();
                }
            },
            onTransitionEnd({ event }) {
                //transition end
                if (!state.expanded && event.target === event.currentTarget && event.propertyName === "transform") {
                    resolveClose?.();
                    resolveClose = null;
                }
                if (state.expanded){
                    this.focus();
                }
            },
          
        }
    }
}
