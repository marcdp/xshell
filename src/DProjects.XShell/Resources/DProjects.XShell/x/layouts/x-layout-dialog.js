import { getDeepActiveElement } from "../utils/dom.js";

// layout
export default {
    contract: {
        description: "Layout for a dialog page.",
        events: {},
        properties: {
            label: { type: "boolean", default: false, attribute: true, state: true, description: "" },
            status: { type: "string", default: "", attribute: true, state: true, description: "" },
            opened: { type: "boolean", default: false, attribute: true, state: true, description: "" }
        },
        methods: {},
        slots: {
            "": {
                description: "Default slot for the layout content."
            }
        }
    },
    meta: {
        renderEngine: "x",
        stateEngine: "proxy"
    },
    style:`
        dialog {
            max-width:90vw;
            min-width:25vw;
            min-height:7em;
            padding:var(--x-layout-dialog-page-padding-vertical) var(--x-layout-dialog-page-padding-horizontal) var(--x-layout-dialog-page-padding-vertical) var(--x-layout-dialog-page-padding-horizontal);
            border:var(--x-layout-dialog-border);
            border-radius:var(--x-layout-dialog-border-radius);
            box-shadow:var(--x-layout-dialog-shadow);
            box-sizing:border-box;
        }
        dialog::backdrop {
            background-color: transparent;
            transition: background-color var(--x-transition-duration) ease;  
            
        }
        dialog:focus {outline:none;}
        dialog.opened::backdrop {
            background-color: var(--x-layout-dialog-backdrop);
        }

        x-loading {
            position:fixed;
            width:var(--x-loading-width);
            left:50%;
            top:var(--x-loading-top);
            transform:translateX(-50%);
            z-index:10;
        }
        .container { position:relative; }
        .header {display:flex; align-items:baseline; padding-bottom:.5em;}
        .header div {flex:1; }
        .header div h2 {margin:0; flex:1; font-size: var(--x-font-size-subtitle); margin-right:1em}
        .header div h2 ~ x-page-description {font-size:var(--x-font-size-small);display:block;}
        .header x-button {transform:translateY(-0.2em);}

        /* fill */
        dialog.fill {width:100%; height:100%; }
        dialog.fill > .container {width:100%; height:100%; display:flex; flex-direction:column;}
        dialog.fill > .container .body {display:flex; flex-direction:column; flex:1;}

        /* width */
        dialog.width20 {width: 20em; min-width:20em;}
        dialog.width30 {width: 30em;}
        dialog.width40 {width: 40em;}
        dialog.width50 {width: 50em;}
        dialog.width60 {width: 60em;}
        dialog.width70 {width: 70em;}
        dialog.width80 {width: 80em;}
        dialog.width90 {width: 90em;}
        dialog.width100 {width: 100em;}

        /* responsive */
        @media (max-width: 768px) {
            dialog {
                min-width:50vw;                
            }
        }

        /* show horizontal bar in x-form footer*/
        ::slotted(x-form) {
            --x-form-footer-hr-display: block;
            --x-form-footer-hr-margin-left: calc( var(--x-layout-dialog-page-padding-horizontal) * -1);
            --x-form-footer-hr-margin-right: calc( var(--x-layout-dialog-page-padding-horizontal) * -1);
        }
        
    `,
    template: `
        <dialog x-attr:class="(state.opened ? 'opened ' : '') + state.pageClasses" x-on:cancel="queryClose">
            <div class="container" >
                <x-loading x-if="state.status=='loading'"></x-loading>
                <div class="header">
                    <div>
                        <h2><x-page-title></x-page-title></h2>
                        <x-page-description></x-page-description>
                        <x-page-info></x-page-info>
                    </div>
                    <x-button class="anchor" icon="x-close" x-on:click="queryClose"></x-button>                                        
                </div>
                
                <div class="body">
                    <slot></slot>
                </div>            
            </div>
        </dialog>

    `,
    state: {
        pageClasses: ""
    },
    controller({ state, events, bus, getPage, host, commands }) {
        let previousFocus = null;
        return {
            load() {
                //load
                events.on(bus, "xshell:page:load", "refresh");
                // bind page load event to update page classes
                events.on(bus, "xshell:page:load", (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.onPageLoaded({event});
                    }
                });
                // enqueue open
                commands.enqueue("open");
                this.refresh();
            },
            mount() {
                previousFocus = getDeepActiveElement();
            },
            open() {
                const dialog = host.shadowRoot.querySelector("dialog");
                if (dialog) {
                    dialog.showModal();
                    state.opened = true;
                }
            },
            refresh() {
                //refresh
                const page = getPage();
                if (page) state.label = page.label;
            },

            queryClose(args) {
                //query close
                args.event.preventDefault();
                host.dispatchEvent(new CustomEvent("queryClose", { composed: true }));
            },
            unmount() {
                // try restore previous focus
                if (previousFocus?.isConnected) {
                    setTimeout(() => {
                        previousFocus.focus({ preventScroll: true });
                    }, 0);
                }                
            },

            // events
            onPageLoaded({ event }) {
                const page = getPage();
                if (page) {
                    state.pageClasses = page.meta?.classes?.join(" ") || "";
                }
            },

        }
    }
};
