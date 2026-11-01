
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
        <x-page-info></x-page-info>
        <slot></slot>
    `,
    state: {
        status: ""
    },    
};
