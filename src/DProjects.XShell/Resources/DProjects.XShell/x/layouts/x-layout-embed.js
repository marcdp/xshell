
// layout
export default {
    contract: {
        description: "Layout for an embedded page.",
        events: {},
        properties: {
            status: { type: "string", default: "", attribute: true, state: true, description: "" },
        },
        methods: {},
        slots: {
            "": {
                description: "Default slot for the layout content."
            },
            "header-actions": {
                description: "Slot for header actions."
            }
        }
    },
    meta: {
        renderEngine: "x",
        stateEngine: "proxy"
    },
    style: `
        :host {
            display:block;
            padding: var(--x-layout-embed-page-padding-vertical) var(--x-layout-embed-page-padding-horizontal) var(--x-layout-embed-page-padding-vertical) var(--x-layout-embed-page-padding-horizontal);
        }
        ::slotted(p:first-child) {
            margin-top:0;
        }
        ::slotted(p:last-child) {
            margin-bottom:0;
        }        
        .header {display:flex; justify-content:end; align-items:center; }
        .header .title {flex:1; margin-bottom:1em; }
        .header .title x-page-title {margin:0; font-weight:500;}
        .header .title x-page-description {margin:0; font-weight:normal; font-size:var(--x-font-size-small);}
        .header .header-actions {float:right}
        .no-title .header {display:none;}
        
        
        x-loading {
            position:absolute;
            width:var(--x-loading-width);
            left:50%;
            z-index:10;
        }        
    `,
    template: `
        <x-loading x-if="state.status=='loading'"></x-loading>        
        <div x-attr:class="state.pageClasses">
            <div class="header">
                <div class="title">
                    <x-page-title></x-page-title>
                    <x-page-description></x-page-description>
                </div>
                <div class="header-actions">
                    <slot name="header-actions"></slot>
                </div>
            </div>
            <slot></slot>
        </div>
    `,
    state: {
        pageClasses: ""
    },
    controller({ events, bus, state, getPage }) {
        return {
            load() {
                // bind page load event to update page classes
                events.on(bus, "xshell:page:load", (event)=>{
                    if (event.detail.id == getPage()?.id) {
                        this.onPageLoaded({event});
                    }
                });
            },
            onPageLoaded({ event }) {
                // update page classes when the page is loaded
                state.pageClasses = getPage()?.meta?.classes?.join(" ") || "";
            }
            
        };
    }
};
