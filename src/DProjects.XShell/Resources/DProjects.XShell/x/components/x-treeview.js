
// contract
export const contract = {
    description: "Provides keyboard navigation and selection for a tree of tree-view items.",
    events: {
        toggle: {description: "Fired when a tree-view item is toggled."},
        select: {description: "Fired when a tree-view item is selected."}
    },
    properties: {
        multiple: {type:"boolean", default:false, attribute:true, state:true, description:""}
    },
    methods: {},
    slots: {
        "": {
            description: "Default slot for tree-view items."
        }
    }
};


// implementation
export default {
    style: `
        :host {
            display:block; 
            --x-treeview-indent: 0;
        }        
        div:focus {outline:none;}
        :host div:focus {
            --x-treeview-item-selected-border: .1em var(--x-color-gray) dotted;
        }
    `,
    template: `
        <div ref="div" tabindex="0">
            <slot x-on:slotchange="refresh" x-on:click="click"></slot>
        </div>
    `,
    state: {
    },
    controller({ state, events, host, timer }) {
        return {
            async load(args) {
                // load
                host.addEventListener("keydown", (event) => {this.keydown({event});});
                host.addEventListener("toggle", (event) => {this.refresh({event});});
                host.addEventListener("focusin", (event) => {this.focusIn({event});});
                events.on(state, "change:items", "build-items");
                // detect changes in light dom
                this.mutationObserver = new MutationObserver(()=>{
                    this.refresh();
                });
                this.mutationObserver.observe(host, {
                    childList: true, // Observe additions/removals of child nodes
                    attributes: false, // Observe attribute changes
                    subtree: false // Observe changes in child nodes' children
                });
            },

            async unload(args) {
                // unload
                this.mutationObserver?.disconnect();
                delete this.mutationObserver;
            },

            async focusIn({event}){
                timer.setTimeout(() => {
                    let items = host.querySelectorAll("x-treeview-item");
                    let selected = null;
                    for(let target of items) {
                        if (target.selected) selected = target;
                    }
                    if (!selected && items.length > 0) {
                        items[0].selected = true;
                        items[0].focus();                    
                    }
                }, 100);
            },

            async keydown(args) {
                let event = args.event;
                // get visible items
                let items = [];
                let getRecursive = (element) => {
                    for (let child of element.children) {
                        if (child.localName == "x-treeview-item") {
                            items.push(child);
                            if (!child.expanded) continue;
                        }
                        getRecursive(child);
                    }
                };
                getRecursive(host);
                // get selected items
                let selected = null;
                let selecteds = [];
                for(let target of items) {
                    if (target.selected) {
                        selecteds.push(target);
                        selected = target;
                    }
                }
                // process key
                let pageSize = 10;
                let newSelecteds = null;
                if (event.key == "ArrowUp") {
                    let index = items.indexOf(selected);
                    if (index > 0) newSelecteds = [items[index-1]];
                    event.preventDefault();
                } else if (event.key == "ArrowDown") {
                    let index = items.indexOf(selected);
                    if (index < items.length - 1) newSelecteds = [items[index+1]];
                    event.preventDefault();
                } else if (event.key == "ArrowLeft") {
                    if (selected) {
                        if (selected.expanded) {
                            selected.expanded = false;
                            selected.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: selected.path}}));
                        } else if (selected.parentElement && selected.parentElement.localName == "x-treeview-item") {
                            newSelecteds = [selected.parentElement];
                            selected.expanded = false;
                        }
                    }
                    event.preventDefault();
                } else if (event.key == "ArrowRight") {
                    if (selected) {
                        if (!selected.expanded) {
                            selected.expanded = true;
                            selected.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: selected.path}}));
                        } else {
                            let index = items.indexOf(selected);
                            if (index < items.length - 1) newSelecteds = [items[index+1]];
                        }
                    }
                    event.preventDefault();
                } else if (event.key == "PageUp") {
                    let inc = pageSize;
                    let index = items.indexOf(selected);
                    if (index > 0) {
                        newSelecteds = [items[Math.max(index-inc, 0)]];
                        selected.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: items[Math.max(index-inc, 0)].path}}));
                    }
                    event.preventDefault();
                } else if (event.key == "PageDown") {
                    let inc = pageSize;
                    let index = items.indexOf(selected);
                    if (index < items.length - 1) {
                        newSelecteds = [items[Math.min(index+inc, items.length-1)]];
                        selected.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: items[Math.min(index+inc, items.length-1)].path}}));
                    }
                    event.preventDefault();
                } else if (event.key == " ") {
                    if (selected) {
                        selected.expanded = !selected.expanded;
                        selected.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: selected.path}}));
                    }
                    event.preventDefault();
                } else if (event.key == "Enter") {
                    if (selected) {
                        selected.expanded = !selected.expanded;
                        selected.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: selected.path}}));
                        selected.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: selected.path}}));
                    }
                    event.preventDefault();
                }
                // reselect
                if (newSelecteds) {
                    selecteds.forEach((item) => { item.selected = false; });
                    newSelecteds.forEach((item) => { item.selected = true; });
                }
            },

            async refresh(args) {
                // grid-template-columns
                const columns = host.querySelectorAll(":scope > x-treeview-head > x-treeview-column");
                const gridTemplateColumns = [...columns]
                    .map(column =>
                        column.getAttribute("width")?.trim() ||
                        "minmax(0, 1fr)"
                    )
                    .join(" ");
                if (gridTemplateColumns) {
                    host.style.setProperty("--x-treeview-grid-template-columns",gridTemplateColumns);
                } else {
                    host.style.removeProperty("--x-treeview-grid-template-columns");
                }
            },

            async click(args) {
                // click
                let event = args.event;
                let item = event.target.closest("x-treeview-item");
                if (item) {
                    if (state.multiple) {
                        item.selected = !item.selected;
                    } else {
                        let items = host.querySelectorAll("x-treeview-item");
                        items.forEach((item) => {
                            item.selected = false;
                        });
                        item.selected = true;
                    }
                    item.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: item.path}}));
                }
                // focus if required
                if (!document.activeElement || document.activeElement.localName == "body") {
                    host.shadowRoot.querySelector('[ref="div"]').focus();
                }
            }
        };
    }
};

