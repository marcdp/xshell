
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
        x-loading {
            width:var(--x-loading-width);
            left:50%;
            transform:translateX(-50%);
            z-index:10;
        }
        div.width20 {width: 20em;}
        div.width30 {width: 30em;}
        div.width40 {width: 40em;}
        div.width50 {width: 50em;}
        div.width60 {width: 60em;}
        div.width70 {width: 70em;}
        div.width80 {width: 80em;}
        div.width90 {width: 90em;}
        div.width100 {width: 100em;}
    `,
    template: `
        <x-loading x-if="state.status=='loading'"></x-loading>        
        <div x-attr:class="state.pageClasses">
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
