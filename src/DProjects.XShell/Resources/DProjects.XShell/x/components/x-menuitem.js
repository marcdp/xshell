// component
export default {
    contract: {
        description: "Displays a menu item with optional nested menu content.",
        tags: ["navigation", "menus", "commands"],
        events: {},
        properties: {
            icon:        {type:"string", default:"", attribute:true, state:true, description:""},
            label:       {type:"string", default:"", attribute:true, state:true, description:""},
            href:        {type:"string", default:"", attribute:true, state:true, description:""},
            suffix:      {type:"string", default:"", attribute:true, state:true, description:""},
            command:     {type:"string", default:"", attribute:true, state:true, description:""},
            selected:    {type:"boolean", default:false, attribute:true, state:true, description:""},
            checked:     {type:"boolean", default:false, attribute:true, state:true, description:""},
            open:        {type:"string", default:"", attribute:true, state:true, description:"Indicates whether the menu item is open.", enum:["stack", "top", "dialog", "dock"]},
            disabled:    {type:"boolean", default:false, attribute:true, state:true, description:""},
            embedded:    {type:"boolean", default:false, attribute:true, state:true, description:"Hosts the target Page inline instead of rendering a navigation anchor."},
            tooltip:     {type:"string", default:"", attribute:true, state:true, description:"Optional tooltip text shown on the navigation anchor."},
            open:        {type: "string",default: "",attribute: true,state: true,enum: ["auto", "stack", "top", "dialog", "dock", "embed"]},
            outlet:      {type: "string",default: "",attribute: true,state: true}
        },
        methods: {
            focus: {description: "Focuses the menu item."},
            expand: {description: "Handles click events on the menu item."}
        },
        slots: {
            "": {
                description: "Default slot for the menu item content."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Display an icon and a link as a menu item.",
                template: `<x-menuitem label="Global" icon="x-folder" href="page:x:/pages/global.js"></x-menuitem>`
            },
            {
                name: "submenu",
                description: "Toggle an inline submenu by clicking its parent item.",
                template: `
                    <x-menuitem class="inline" label="Tools">
                        <x-menuitem label="Tasks" href="page:x:/pages/tasks.js" open="stack"></x-menuitem>
                    </x-menuitem>
                `
            }
        ]
    },
    style: `
        :host {display:flex; position:relative; box-sizing:border-box; flex-direction:column; margin-bottom:.15em;
            --x-menuitem-indent: calc(var(--x-menu-indent, -1) + 1);
        }
        
        /* default */
        :host x-anchor {display:flex; flex:1; flex-direction:row; align-items:center; cursor:pointer; border-radius:var(--x-menuitem-border-radius); user-select: none;  
            
        }
        :host x-anchor:hover {background:var(--x-menuitem-background-hover); z-index:1;}
        :host x-anchor x-icon {color:var(--x-color-text)!important; text-align:center;}
        :host x-anchor span.label {color:var(--x-color-text)!important; flex:1;  display:block; padding-top:.4em; padding-bottom:.4em; white-space:nowrap; padding-right:1.5em; padding-left: calc(var(--x-menuitem-indent) * 1em)!important;}
        :host x-anchor span.suffix {color:var(--x-color-text-gray)!important; padding-left:1em;}
        :host x-anchor x-icon.has-childs {width:unset; margin-left:.25em;}
        :host x-anchor x-icon:first-child {width:2em; text-align:left;}
        :host x-anchor x-icon:first-child:last-child {align-self:flex-end;}
        :host x-anchor x-icon + .label {padding-left:.35em;}
        :host x-anchor.selected {font-weight: 500; background:var(--x-menuitem-background-selected);}
        :host x-anchor:active {font-weight: normal; background:var(--x-menuitem-background-active);}
        :host .menuitem[disabled] {pointer-events:none; cursor:default; --x-color-text:var(--x-color-text-disabled);}

        :host HR {border:none; background:var(--x-menuitem-separator-color); height:.05em; margin-top:.15em; margin-bottom:.15em; display:block; box-sizing: border-box; width:100%;}
       
        /* dropdown */
        x-contextmenu {width: var(--x-contextmenu-width);position:absolute; left:100%;box-sizing:border-box; margin-left:0em;margin-top:-.2em;}
        x-contextmenu.down {top:calc(100% + .2em); left:-.1em;}
        x-contextmenu.left {left:100%!important; margin-left:.1em; transform:translateX(-100%);}

        /* inline */
        :host(.inline) {display:block;}
        :host(.inline) x-anchor .has-childs {transform:rotate(90deg); transition: transform var(--x-transition-duration);}
        :host(.inline) x-anchor[expanded] .has-childs {transform:rotate(-90deg)}
        :host(.inline) > x-contextmenu {
            --x-menu-indent: var(--x-menuitem-indent);
            position:unset; 
            width:100%; 
            margin:0; 
            margin-bottom: -.15em;
        }

        /* icon */
        :host(.icon) {}
        :host(.icon) x-anchor {padding:0;}
        :host(.icon) x-icon:first-child {text-align:center; width:unset; font-size:1.2em;}
        :host(.icon) x-anchor::part(a) {height:2.7em; }
        :host(.icon) x-icon.has-childs {display:none;}
        :host(.icon) x-anchor span {
            position:absolute;
            left:100%;
            display:none;
            z-index:10;
            background:var(--x-menuitem-background);
            margin-left:.3em;
            padding:0;
            padding-left:1em!important;
            padding-right:1em!important;
            line-height:2em;
            background:var(--x-tooltip-background);
            border:var(--x-tooltip-border);
            color:var(--x-tooltip-color);
            border-radius:var(--x-tooltip-border-radius, .35em);
            box-shadow:var(--x-tooltip-shadow, none);
        }
        :host(.icon) x-anchor:hover span {display:block;animation: show-tooltip 0s var(--x-tooltip-delay) both;}
        @keyframes show-tooltip {
            from { display: none; }
            to   { display: block; }
        }

        /* top right */
        :host(.top.right) x-contextmenu {bottom:0!important;}
        :host(.top.right) x-contextmenu::part(container) {transform:translateY(-100%);}
        
    `,
    state: {
        command:"",
        href:"",
        embedded: false,
        expanded: false,
        childsInline: false,
        childsDown: false,
        childsLeft: false,
    },
    template: `
        <hr x-if="state.label=='-'" />
        <div x-elseif="state.embedded">
            <x-page x-attr:src="state.href" loading="lazy"></x-page>
        </div>
        <x-button x-elseif="state.command" class="menuitem" x-attr:command="state.command" x-attr:label="state.label" x-attr:icon="state.icon" x-attr:disabled="state.disabled" >
        </x-button>
        <x-anchor x-else class="menuitem anchor" x-class:down="state.childsDown" x-attr:href="state.href" x-attr:disabled="state.disabled" x-attr:expanded="state.expanded" x-class:selected="state.selected" x-attr:tooltip="state.tooltip" x-attr:open="state.open" x-attr:outlet="state.outlet">
            <x-icon x-if="state.checked" icon="x-check"></x-icon>
            <x-icon x-if="!state.checked && state.icon" class="icon" x-attr:icon="state.icon"></x-icon>
            <span   x-if="state.label" class="label">{{ state.label + ' ' + state.command}}</span>
            <span   x-if="state.suffix" class="suffix">{{ state.suffix }}</span>
            <x-icon x-if="state.hasChilds" class="has-childs" x-attr:icon="(state.childsDown ? 'x-keyboard-arrow-down' : 'x-keyboard-arrow-right')"></x-icon>
        </x-anchor>
        <x-contextmenu x-if="state.hasChilds" x-show="state.expanded" submenu x-class:down="state.childsDown" x-class:left="state.childsLeft" x-class:inline="state.childsInline">
            <slot x-on:slotchange="refresh"></slot>
        </x-contextmenu>
        
    `,
    controller({ state, host }) {
        return {
            mount() {
                //load
                host.addEventListener("mouseenter", ()=>{
                    if (host.classList.contains("inline")) {
                    } else {
                        const horizontal = host.parentNode?.parentNode?.host?.classList.contains("horizontal");
                        if (horizontal) {
                        } else {
                            state.expanded = true;
                            this.refresh();
                        }
                    }
                });
                host.addEventListener("mouseleave", ()=>{
                    if (host.classList.contains("inline")) {
                    } else {
                        const horizontal = host.parentNode?.parentNode?.host?.classList.contains("horizontal");
                        if (horizontal) {
                        } else {
                            state.expanded = false;
                            this.refresh();
                        }
                    }
                });
                host.addEventListener("click", (event) => {
                    host.shadowRoot.querySelector("x-anchor")?.focus();
                    const horizontal = host.parentNode?.parentNode?.host?.classList.contains("horizontal");
                    if (host.classList.contains("inline") || horizontal) {
                        state.expanded = !state.expanded;
                        this.refresh();
                    }
                    event?.preventDefault();
                    event?.stopPropagation();
                });
                this.refresh();
            },

            expand(){
                if (host.parentNode?.localName == "x-contextmenu") {
                    state.expanded = true;
                    this.refresh();
                }
            },

            refresh(args) {
                //refresh
                state.hasChilds = (host.firstElementChild != null);
                if (state.hasChilds) {
                    let rect = host.getBoundingClientRect();
                    // childsInline
                    state.childsInline = host.classList.contains("inline");
                    // childsDown
                    const horizontal = host.parentNode?.parentNode?.host?.classList.contains("horizontal");
                    if (horizontal) {
                        state.childsDown = horizontal;
                    }
                    // childsLeft
                    let right = rect.left + rect.width * 2.5;
                    state.childsLeft = right > window.innerWidth;
                }
            },

            focus() {
                const button = host.shadowRoot.querySelector("x-button");
                const anchor = host.shadowRoot.querySelector("x-anchor");
                if (button) {
                    button.focus();
                } else if (anchor) {
                    anchor.focus();
                }
            }
        };
    }
};
