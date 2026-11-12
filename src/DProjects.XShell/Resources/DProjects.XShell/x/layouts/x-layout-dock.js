
// layout
export default {
    contract: {
        description: "Layout for an docked page.",
        events: {
            toggledock: {
                description: "Event fired when the dock is toggled."
            }
        },
        properties: {
            status: { type: "string", default: "", attribute: true, state: true, description: "" },
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
        stateEngine: "proxy"
    },
    style: `
        :host {
            display:flex;
            flex-direction:column;
            flex:1;
            height:100%;            
        }
        x-loading {width:var(--x-loading-width);left:50%;transform:translateX(-50%);z-index:10;}
        .title {border-bottom:var(--x-layout-main-border); ccolor:var(--x-color-gray); padding-left:.65em; padding-right:.65em; min-height:3.15em;}
        .title x-page-title {padding-left:0em; font-weight:600; padding-right:1em; padding-top:.5em; padding-bottom:.5em; }
        .body { 
            flex:1;
            overflow:auto;
            scrollbar-width: thin;
            padding: var(--x-layout-dock-page-padding-vertical) var(--x-layout-dock-page-padding-horizontal) var(--x-layout-dock-page-padding-vertical) var(--x-layout-dock-page-padding-horizontal); 
        }
    `,
    template: `
        <x-loading x-if="state.status=='loading'"></x-loading>
        <x-toolbar class="title">
            <x-page-title></x-page-title>
            <slot name="header-actions"></slot>
            <span style="flex:1"></span>
            <x-page-info></x-page-info>
            <x-button icon="x-toggle-panel-bottom" class="round light" x-on:click="onDockToggle"></x-button>
            <x-button icon="x-close" x-on:click="onClose" class="round light"></x-button>            
        </x-toolbar>
        <div x-attr:class="'body ' + state.pageClasses">
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

            // events
            onDockToggle(){
                const page = getPage();
                if (page) {
                    page.host.dispatchEvent(new CustomEvent("toggledock"));
                }                
            },
            onClose() {
                // close
                const page = getPage();
                if (page) {
                    page.close();
                }
            },
            onPageLoaded({ event }) {
                // update page classes when the page is loaded
                state.pageClasses = getPage()?.meta?.classes?.join(" ") || "";
            }            
        };
    }
};
