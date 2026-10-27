// contract
export const contract = {
    description: "Displays a selectable, expandable item in a tree view.",
    events: {
        toggle: {
            description: "Raised when the item expansion state changes."
        }
    },
    properties: {
        indent:      {type:"number", default:0, attribute:true, state:true, description:""},
        icon:        {type:"string", default:"x-file", attribute:true, state:true, description:""},
        label:       {type:"string", default:"", attribute:true, state:true, description:""},
        description: {type:"string", default:"", attribute:true, state:true, description:""},
        path:        {type:"string", default:"", attribute:true, state:true, description:""},
        
        hasChilds:   {type:"boolean", default:false, attribute:true, state:true, description:""},
        hasChildsForced: {type:"boolean", default:false, attribute:true, state:true, description:""},
        expanded:    {type:"boolean", default:false, attribute:true, state:true, description:""},
        selected:    {type:"boolean", default:false, attribute:true, state:true, description:""},
    },
    methods: {},
    slots: {
        "": {
            description: "Default slot for tree-view item content."
        },
        "column": {
            description: "Slot for column content."
        }
    }
};


// implementation
export default {
    style: `
        :host {
            display:block;
        }
        .row {
            display:grid; 
            grid-template-columns: var(--x-treeview-grid-template-columns);
        }
        .row .cell {
            white-space: nowrap;
            box-sizing:border-box;
            padding-left: calc(.5em + var(--x-treeview-indent) * 1.25em);
            display:flex;
            user-select: none;
            line-height: 1.8em;
            
        }
        .row .cell > x-icon {cursor:pointer; display:inline-block; transform:translateY(-.1em);}
        .row .cell label {flex:1; display:block; cursor:pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
        .row .cell label x-icon {cursor:pointer; display:inline-block; transform:translateY(-.1em);}

        .row.selected {background:var(--x-color-background-x-gray); border-radius:.25em; outline:var(--x-treeview-item-selected-border);}
        .row.no-childs .cell > x-icon {visibility:hidden;}
        .row.expanded .cell > x-icon {transform:rotate(90deg);}

        .row ::slotted(div) {white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        x-spinner {display:none; --x-color-primary:var(--x-color-text);}
        :host(.loading) x-spinner {display:inline-block; transform:translate(-.25em,.25em); margin-right:.075em;}
        :host(.loading) x-spinner + x-icon {display:none;}

    `,
    template: `
        <div class="row" 
            x-class:selected="state.selected" 
            x-class:expanded="state.expanded" 
            x-class:childs="state.hasChilds || state.hasChildsForced" 
            x-class:no-childs="!state.hasChilds && !state.hasChildsForced" 
        >
            <div class="cell" x-on:dblclick="toggle">
                <x-spinner></x-spinner>
                <x-icon icon="x-keyboard-arrow-right" x-on:click="toggle"></x-icon>
                <label x-attr:title="state.description" >
                    <x-icon x-attr:icon="state.icon"></x-icon>
                    <span class="label" x-text="state.label"></span>
                    <span class="description" x-text="state.description"></span>
                </label>
            </div>
            <slot name="column"></slot>            
        </div>
        <div class="children" x-if="state.expanded"> 
            <slot></slot>
        </div>
    `,
    state: {
    },
    controller({ state, host }) {
        let styleSheet = new CSSStyleSheet();
        return {
            async load() {
                //load
            },

            mount() {
                host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, styleSheet];
                this.refresh();
            },

            async toggle() {
                //toggle
                if (state.expanded) {
                    this.collapse();
                } else {
                    this.expand();
                }
            },

            async expand() {
                //expand
                if (state.hasChilds || state.hasChildsForced) {
                    state.expanded = true;
                    host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: state.path}}));
                }
            },

            async collapse() {
                //collapse
                if (state.expanded) {
                    state.expanded = false;
                    host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: state.path}}));
                }
            },

            async refresh() {
                //refresh
                state.hasChilds = (host.querySelectorAll(':scope > :not([slot])').length > 0);
                //indent
                let element = host;
                let indent = 0;
                while (element && element.localName !== "x-treeview") {
                    element = element.parentElement; // Move directly to the parent
                    if (element && element.localName == "x-treeview-item") {
                        indent++;
                    }
                }
                state.indent = indent;
                // update the stylesheet with the new indent level
                styleSheet.replaceSync(':host .children {--x-treeview-indent:' + (indent + 1) + '}');
            }
        };
    }
};

