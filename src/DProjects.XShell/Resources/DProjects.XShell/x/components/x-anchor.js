
// component
export default {
    contract: {
        description: "Renders a navigation link handled by the XShell navigation service.",
        tags: ["navigation", "links"],
        events: {},
        properties: {
            href:       {type:"string", default:"", attribute:true, state:true, description:""},
            open:       {type:"string", default:"auto", attribute:true, state:true, description:"", enum: ["auto","top","stack","dialog","dock","embed"]},
            query:      {type:"object", default:{}, attribute:true, state:true, description:""},
            classes:    {type:"array", default:[], state:true, description:"Presentation classes for the target stacked Page.", schema:{type:"array", items:{type:"string"}}},
            breadcrumb: {type:"boolean", default:false, attribute:true, state:true, description:""},
            title:      {type:"string", default:null, attribute:true, state:true, description:""},
            icon:       {type:"string", default:null, attribute:true, state:true, description:""},
            disabled:   {type:"boolean", default:false, attribute:true, state:true, description:""},
            target:     {type:"string", default:null, attribute:true, state:true, description:""},
            outlet:     {type:"string", default:null, attribute:true, state:true, description:""},
            rel:        {type:"string", default:null, attribute:true, state:true, description:"", reflect:true},
            replace:    {type:"boolean", default:false, attribute:true, state:true, description:""},
            tooltip:    {type:"string", default:"", attribute:true, state:true, description:""}
        },
        methods: {
            focus: {
                description: "Focuses the anchor element."
            }

        },
        slots: {
            "": {
                description: "Default slot for the anchor content."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Navigate to the Areas page using the default opening behavior.",
                template: `<x-anchor href="page:x:/pages/global.js">Browse global</x-anchor>`
            },
            {
                name: "stack",
                description: "Open Tasks above the current Page.",
                template: `<x-anchor href="page:x:/pages/tasks.js" open="stack">View tasks</x-anchor>`
            },
            {
                name: "compact-stack",
                description: "Bind presentation classes to the stacked Page.",
                state: {classes: ["size-compact"]},
                template: `<x-anchor href="page:x:/pages/tasks.js" open="stack" x-prop:classes="state.classes">View tasks</x-anchor>`
            }
        ]
    },
    style: `
        :host {}
        :host a {display:inline; align-items:center; width:100%; }
        :host a[disabled] { pointer-events: none; color:var(--x-color-gray);}
        
        :host(.menuitem) {}
        :host(.menuitem) a {display:flex; padding-left:.6em; padding-right:.6em; text-decoration:none; min-height:2.1em; border-radius:var(--x-menuitem-border-radius); }
        :host(.menuitem) a:hover {color:var(--x-color-primary); background:var(--x-menuitem-background-hover);}
        :host(.menuitem) a:active {color:var(--x-color-primary-dark); background:var(--x-menuitem-background-active);}
        :host(.menuitem) a:focus {outline:none; background:var(--x-menuitem-background-active);}
        :host(.menuitem[expanded]) a {background:var(--x-menuitem-background-active);}

        :host(.block) {}
        :host(.block) a {display:block;}

        :host(.plain) {}
        :host(.plain) a {text-decoration:none; color:var(--x-color-text)}
        :host(.plain) a:hover {color:var(--x-color-primary);}
        :host(.plain) a:active {color:var(--x-color-primary-dark)}
        :host(.plain.selected) a {color:var(--x-color-primary);}
        :host(.plain.selected) a:hover {color:var(--x-color-primary-dark);}    

        :host(.round) {}
        :host(.round) a {border: var(--x-button-border); display:flex; width:2.5em; text-align:center; border-radius:50%; padding-left:0; padding-right:0; justify-content: center; box-sizing:border-box;height:2.45em; }

        :host(.light) a {background:var(--x-button-background); border-color:var(--x-color-background-gray); color:var(--x-color-text); }
        :host(.light) a:hover {background:var(--x-button-background-hover-light); border-color:var(--x-color-background-x-gray); }
        :host(.light) a:active {background:var(--x-button-background-active-light); border-color:var(--x-color-background-xx-gray); }
    `,
    template: `
        <a part="a" x-attr:href="state.hrefReal" x-attr:disabled="state.disabled" x-attr:target="state.target" x-attr:rel="state.rel" x-attr:title="state.tooltip" x-on:click="click" x-on:keydown="keydown" tabindex="1"><slot></slot></a>
    `,
    state: {
        hrefReal: null
    },
    controller({ state, navigation, getPage, host }) {
        return {
            load(params) {
                // load
            },

            stateChange(params) {
                // refresh
                if (state.href) {
                    const page = getPage();
                    const href = navigation.buildUrlAbsolute({
                        href:       state.href,
                        params:     state.query,
                        open:       state.open,
                        replace:    state.replace,
                        page:       page,
                        nav: {
                            breadcrumb: (state.breadcrumb ? page?.breadcrumb : null),
                            title:      state.title,
                            icon:       state.icon
                        }
                    });
                    // set real href
                    state.hrefReal = href;
                }
            },

            focus() {
                // focus
                const a = host.shadowRoot.querySelector("a");
                if (!a.tabIndex) a.tabIndex = 0;
                a.focus();
            },

            click(params) {
                // click
                const event = params.event;
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || state.target) return;
                if (!state.href) return;
                if (!state.href.startsWith("page:") && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(state.href)) return;
                const page = getPage();
                navigation.navigate( {
                    href: state.href,
                    params: state.query,
                    open: state.open,
                    ...(state.open === "stack" && state.classes?.length ? { classes: state.classes } : {}),
                    replace: state.replace,
                    page: page,
                    outlet: state.outlet,
                    nav: {
                        breadcrumb: (state.breadcrumb ? page.breadcrumb : null),
                        title:      state.title,
                        icon:       state.icon
                    }
                });
                event.preventDefault();
            },

            async keydown(args) {
                // keydown
                let event = args.event;
                if (event.key == "Enter" && !event.altKey) {
                    const a = host.shadowRoot.querySelector("a");
                    a.click();
                }
            }
        }
    }
};

