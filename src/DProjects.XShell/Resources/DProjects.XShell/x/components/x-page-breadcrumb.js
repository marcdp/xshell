

// component
export default {
    contract: {
        description: "Displays the current page breadcrumb.",
        tags: ["navigation", "breadcrumbs", "pages"],
        events: {},
        properties: {},
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Place the current Page breadcrumb above its heading.",
                template: `
                    <x-page-breadcrumb></x-page-breadcrumb>
                    <h1><x-page-title></x-page-title></h1>
                `
            }
        ]
    },
    style: `
        :host {display:block;}
        ul {margin:0; padding:0; display: flex; align-items:center; box-sizing: border-box;}
        ul li {list-style:none; margin-right:.5em; display:flex; }
        ul li.empty {display:none;}
        ul li x-anchor {position:relative; font-weight:400; }
        ul li x-icon.separator {color:var(--x-color-text-x-gray); margin-left:.15em; width:.7em;}
        ul li:not(.last) x-anchor { font-weight:500;}
        ul li.last {}
        ul li.last x-icon.separator {display:none}
        ul li.last x-anchor { pointer-events: none;}

        @media (max-width: 768px) {
            ul {overflow:hidden; white-space: nowrap; flex:1;}
            ul li:first-child {flex-shrink:0;}
            ul li {flex-shrink:1;}
            x-anchor {display:inline;overflow:hidden; text-overflow: ellipsis;}
            x-icon.separator {margin-left:0; margin-right:-.35em;}
            ul li:last-child { flex-shrink:1; overflow:hidden;}
        }
    `,
    template: `
        
        <ul x-if="state.breadcrumb">
            <li x-for="item in state.breadcrumb" x-class:empty="!item.label" x-class:last="item==state.breadcrumb[state.breadcrumb.length-1]">
                <x-anchor class="plain" x-attr:href="item.path || item.href">
                    {{ item.label }}
                </x-anchor>
                <x-icon icon="x-keyboard-arrow-right" class="separator"></x-icon>
            </li>
        </ul>        
    `,
    state: {
        breadcrumb: []
    },
    controller({ events, bus, state, getPage }) {
        return {
            load(...args) {
                // load
                events.on(bus, ["xshell:page:load", "xshell:page:change"], (event) => {
                    if (event.detail.id == getPage()?.id) {
                        this.refresh();
                    }
                });
            },

            mount(...args) {
                // mount
                this.refresh();
            },

            refresh(...args) {
                //refresh
                const page  = getPage();
                state.breadcrumb = page?.breadcrumb || [];
            }
        }
    }
};

