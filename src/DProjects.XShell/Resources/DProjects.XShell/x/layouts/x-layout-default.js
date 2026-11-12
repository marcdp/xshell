
// layout
export default {
    contract: {
        description: "Layout for a default page.",
        events: {},
        properties: {},
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
        :host {
            display:block;
            padding: var(--x-layout-default-page-padding-vertical) var(--x-layout-default-page-padding-horizontal) var(--x-layout-default-page-padding-vertical) var(--x-layout-default-page-padding-horizontal);
        }
    `,
    template: `
        <x-loading x-if="state.status=='loading'"></x-loading>
        <div x-attr:class="state.pageClasses">
            <slot></slot>
        </div>
    `,
    state: {
        status: "",
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
