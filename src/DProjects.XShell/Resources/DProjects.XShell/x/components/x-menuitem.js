// component
export default {
    contract: {
        description: "Displays a menu item with optional nested menu content.",
        tags: ["navigation", "menus", "commands"],
        events: {},
        properties: {
            icon:        {type:"string", default:"", attribute:true, state:true, description:""},
            label:       {type:"string", default:"", attribute:true, state:true, description:""},
            description: {type:"string", default:"", attribute:true, state:true, description:""},
            href:        {type:"string", default:"", attribute:true, state:true, description:""},
            suffix:      {type:"string", default:"", attribute:true, state:true, description:""},
            command:     {type:"string", default:"", attribute:true, state:true, description:""},
            selected:    {type:"boolean", default:false, attribute:true, state:true, description:""},
            checked:     {type:"boolean", default:false, attribute:true, state:true, description:""},
            disabled:    {type:"boolean", default:false, attribute:true, state:true, description:""},
            tooltip:     {type:"string", default:"", attribute:true, state:true, description:"Optional tooltip text shown on the navigation anchor."},
            expandOn:    {type: "string", default: "auto", attribute: true, state: true, enum: ["auto", "click", "hover"], description: "Determines how child menu items are expanded."},
            open:        {type: "string", default: "auto", attribute: true, state: true, enum: ["auto", "top", "stack", "dialog", "dock", "embed"], description: "Determines how the target Page is presented."},
            outlet:      {type: "string", default: "", attribute: true, state: true, description: "Names the destination outlet for embedded Page presentation; 'self' hosts the Page inside this item."},
            badge:     {type:"string", default:"", attribute:true, state:true, description:""},
            badgeClass: {type:"string", default:"plain", attribute:true, state:true, description:""},
        },
        methods: {
            focus: {description: "Focuses the menu item."},
            expand: {description: "Expands the child menu items."}
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
                description: "Toggle an inline submenu explicitly by clicking its parent item.",
                template: `
                    <x-menuitem class="inline" label="Tools" expand-on="click">
                        <x-menuitem label="Tasks" href="page:x:/pages/tasks.js" open="stack"></x-menuitem>
                    </x-menuitem>
                `
            }
        ]
    },
    style: `
        :host {display:flex; position:relative; box-sizing:border-box; flex-direction:column; margin-bottom:.15em; --x-menuitem-indent: calc(var(--x-menu-indent, -1) + 1);}
        :host(:last-child) {margin-bottom:0;}
        
        /* default */
        :host x-anchor {display:flex; flex:1; flex-direction:row; align-items:center; cursor:pointer; border-radius:var(--x-menuitem-border-radius); user-select: none; }
        :host x-anchor:hover {background:var(--x-menuitem-background-hover); z-index:1;}
        :host x-anchor x-icon {color:var(--x-color-text)!important; text-align:center; width:2em;}
        :host x-anchor span.label {color:var(--x-color-text)!important; flex:1;  display:block; padding-top:.4em; padding-bottom:.4em; white-space:nowrap; padding-right:1.5em; padding-left: calc(var(--x-menuitem-indent) * 1em)!important; }
        :host x-anchor span.label .description {display:block; font-size:var(--x-font-size-small); color:var(--x-color-text-gray)!important; }
        :host x-anchor span.suffix {color:var(--x-color-text-gray)!important; padding-left:1em;}
        :host x-anchor x-icon.has-childs {width:unset; margin-left:.25em;}
        :host x-anchor x-icon:first-child {width:2em; text-align:center;}
        :host x-anchor x-icon:first-child:last-child {align-self:flex-end;}
        :host x-anchor x-icon ~ .label {apadding-left:.35em!important;}
        :host x-anchor.selected {font-weight: 500; background:var(--x-menuitem-background-selected);}
        :host x-anchor:active {font-weight: normal; background:var(--x-menuitem-background-active);}
        :host .menuitem[disabled] {pointer-events:none; cursor:default; --x-color-text:var(--x-color-text-disabled);}
        :host HR {border:none; background:var(--x-menuitem-separator-color); height:.05em; margin-top:.15em; margin-bottom:.15em; display:block; box-sizing: border-box; width:100%;}

        :host:has(.description) x-anchor::part(a) {align-items: baseline;}

        /* badge */
        :host x-badge {position:absolute; right:-.25em; bottom:-.25em;}
       
        /* dropdown */
        x-contextmenu {width: var(--x-contextmenu-width);position:absolute; left:100%;box-sizing:border-box; margin-left:0em;margin-top:-.2em;}
        x-contextmenu.down {top:calc(100% + .2em); left:-.1em;}
        x-contextmenu.left {left:100%!important; margin-left:.1em; transform:translateX(-100%);}

        /* inline */
        :host(.inline) {display:block;}
        :host(.inline) x-anchor .has-childs {transform:rotate(90deg); transition: transform var(--x-transition-duration);}
        :host(.inline) x-anchor[expanded] .has-childs {transform:rotate(-90deg)}
        :host(.inline) > x-contextmenu {--x-menu-indent: var(--x-menuitem-indent);position:unset; width:100%; margin:0; margin-bottom: -.15em;}

        /* collapsible */
        :host(.collapsible) x-anchor::part(a) {padding-left:.3em; padding-right:.3em;}
        :host(.collapsible) x-anchor span {box-sizing:border-box; width:10em; transition: all 5s; var(--x-transition-duration); box-sizing:border-box; overflow:hidden; }
        :host(.collapsible) x-icon.has-childs {display:none;}
        :host(.collapsible.collapsed) x-anchor::part(a) {}
        :host(.collapsible.collapsed) x-anchor span { width:0em; padding:0;}
        

        :host(.collapsible) x-button { display:block; border:1px red solid; width:10em; transition: all 5s; var(--x-transition-duration)!important;  overflow:hidden;}
        :host(.collapsible.collapsed) x-button  {padding:0;}
        :host(.collapsible.collapsed) x-button::part(button) {padding-right:.2em;}
        :host(.collapsible.collapsed) x-button::part(label) {width:0em; padding:0;}
        :host(.collapsible.collapsed) x-button {width:2.5em; padding:0;}

        /* top right */
        :host(.top.right) x-contextmenu {bottom:0!important;}
        :host(.top.right) x-contextmenu::part(container) {transform:translateY(-100%); margin-left:.05em;}
        
    `,
    state: {
        command:"",
        href:"",
        expanded: false,
        childsInline: false,
        childsDown: false,
        childsLeft: false,
    },
    template: `
        <hr x-if="state.label=='-'" />
        <div x-elseif="state.open == 'embed' && state.outlet == 'self'">
            <x-page x-attr:src="state.href" layout="embed" loading="lazy"></x-page>
        </div>
        <x-button x-elseif="state.command" class="menuitem" x-attr:command="state.command" x-attr:label="state.label" x-attr:icon="state.icon" x-attr:disabled="state.disabled" x-attr:badge="state.badge" x-attr:badge-class="state.badgeClass" x-attr:tooltip="state.tooltip">
        </x-button>
        <x-anchor x-else class="menuitem anchor" x-class:down="state.childsDown" x-attr:href="state.href" x-attr:disabled="state.disabled" x-attr:expanded="state.expanded" x-class:selected="state.selected" x-attr:tooltip="state.tooltip" x-attr:open="state.open" x-attr:outlet="state.outlet">
            <x-icon x-if="state.checked" icon="x-check"></x-icon>
            <x-icon x-if="!state.checked && state.icon" class="icon" x-attr:icon="state.icon"></x-icon>
            <x-badge x-if="state.badge" x-attr:value="state.badge" x-attr:class="state.badgeClass"></x-badge>
            <span x-if="state.label" class="label">
                {{ state.label + ' ' + state.command}}
                <span x-if="state.description" class="description">{{ state.description }}</span>
             </span>
            <span   x-if="state.suffix" class="suffix">{{ state.suffix }}</span>
            <x-icon x-if="state.hasChilds" class="has-childs" x-attr:icon="(state.childsDown ? 'x-keyboard-arrow-down' : 'x-keyboard-arrow-right')" x-on:click="expandTrigger"></x-icon>           
        </x-anchor>
        
        <x-contextmenu x-if="state.hasChilds" x-show="state.expanded" submenu x-class:down="state.childsDown" x-class:left="state.childsLeft" x-class:inline="state.childsInline">
            <slot x-on:slotchange="refresh"></slot>
        </x-contextmenu>
        
    `,
    controller({ state, host }) {
        return {
            mount() {
                // Bind interaction listeners once for the mounted Component.
                this._mouseEnter = event => this.mouseEnter(event);
                this._mouseLeave = event => this.mouseLeave(event);
                this._click = event => this.click(event);
                this._keydown = event => this.keydown(event);
                this._commandActivated = event => this.commandActivated(event);
                this._documentPointerDown = event => this.documentPointerDown(event);
                this._siblingExpanded = event => this.siblingExpanded(event);
                host.addEventListener("mouseenter", this._mouseEnter);
                host.addEventListener("mouseleave", this._mouseLeave);
                host.addEventListener("click", this._click, true);
                host.addEventListener("keydown", this._keydown);
                host.addEventListener("command", this._commandActivated);
                this.refresh();
            },

            unmount() {
                // Remove host and document listeners retained by this Component.
                host.removeEventListener("mouseenter", this._mouseEnter);
                host.removeEventListener("mouseleave", this._mouseLeave);
                host.removeEventListener("click", this._click, true);
                host.removeEventListener("keydown", this._keydown);
                host.removeEventListener("command", this._commandActivated);
                this.collapse();
            },

            expansionMode() {
                // Resolve automatic behavior without coupling explicit modes to presentation.
                if (state.expandOn !== "auto") return state.expandOn;
                const horizontal = host.parentNode?.parentNode?.host?.classList.contains("horizontal");
                return host.classList.contains("inline") || horizontal ? "click" : "hover";
            },

            mouseEnter() {
                // Expand hover-driven items while the pointer is within the item or its submenu.
                if (this.expansionMode() === "hover") this.expand();
            },

            mouseLeave() {
                // Collapse hover-driven items after the pointer leaves the complete item subtree.
                if (this.expansionMode() === "hover") this.collapse();
            },

            click(event) {
                // Ignore interactions inside embedded Pages.
                const path = event.composedPath();
                if (path.slice(0, path.indexOf(host)).some(element => element.localName === "x-page")) return;
                
                // Let nested items activate independently and dismiss this dropdown after activation.
                const item = path.find(element => element.localName === "x-menuitem");
                if (item !== host) {
                    if (state.expanded && !host.classList.contains("inline")) this.collapse();
                    return;
                }

                // Let the dedicated indicator handler own indicator activation.
                if (path.some(element => element.classList?.contains("has-childs"))) return;

                // Focus the trigger and toggle click or touch-driven items without swallowing activation.
                host.shadowRoot.querySelector("x-anchor")?.focus();
                const touch = event.pointerType && event.pointerType !== "mouse" || event.sourceCapabilities?.firesTouchEvents;
                const togglesItem = this.expansionMode() === "click" || touch;
                if (!togglesItem || !state.hasChilds || state.disabled) return;
                this.toggle();
                if (!state.href && !state.command) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },

            expandTrigger({event}) {
                // Use the submenu indicator without consuming an item's destination activation.
                if (!state.hasChilds || state.disabled) return;
                event.preventDefault();
                event.stopPropagation();
                this.toggle();
            },

            keydown(event) {
                // Dismiss the nearest expanded dropdown with Escape.
                if (event.key !== "Escape" || !state.expanded || host.classList.contains("inline")) return;
                event.preventDefault();
                event.stopPropagation();
                this.collapse();
                this.focus();
            },

            commandActivated(event) {
                // Dismiss a dropdown after a command inside it is activated.
                const path = event.composedPath();
                if (path.slice(0, path.indexOf(host)).some(element => element.localName === "x-page")) return;

                // Dismiss the dropdown after menu command activation.
                if (state.expanded && !host.classList.contains("inline") && event.target !== host) this.collapse();
            },

            documentPointerDown(event) {
                // Dismiss a dropdown when pointer activation starts outside its subtree.
                if (!event.composedPath().includes(host)) this.collapse();
            },

            siblingExpanded(event) {
                // Keep only one dropdown expanded for sibling items in the same menu.
                const item = event.detail?.item;
                if (item && item !== host && item.parentNode === host.parentNode) this.collapse();
            },

            expand() {
                // Expand only enabled items that currently contain child menu items.
                this.refresh();
                if (!state.hasChilds || state.disabled || state.expanded) return;
                state.expanded = true;
                if (!host.classList.contains("inline")) {
                    document.addEventListener("pointerdown", this._documentPointerDown, true);
                    document.addEventListener("x-menuitem-expand", this._siblingExpanded, true);
                    host.dispatchEvent(new CustomEvent("x-menuitem-expand", {detail: {item: host}, bubbles: true, composed: true}));
                }
            },

            collapse() {
                // Collapse centrally and release dropdown dismissal listeners.
                state.expanded = false;
                document.removeEventListener("pointerdown", this._documentPointerDown, true);
                document.removeEventListener("x-menuitem-expand", this._siblingExpanded, true);
            },

            toggle() {
                // Toggle through the shared expansion and collapse paths.
                if (state.expanded) this.collapse();
                else this.expand();
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
