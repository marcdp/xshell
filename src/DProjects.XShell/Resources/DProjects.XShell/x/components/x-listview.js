// contract
export const contract = {
    description: "Displays and manages a selectable flat collection in list, details, icons, or tiles view.",
    events: {
        select: {
            description: "Raised when an item's selected state changes through list interaction.",
            detail: {
                item: {type:"object", required:true},
                index: {type:"number", required:true},
                selected: {type:"boolean", required:true},
                selectedItems: {type:"array", required:true}
            },
            bubbles: true,
            composed: true
        },
        activate: {
            description: "Raised when an item is activated by Enter, a link click, or a double click.",
            detail: {
                item: {type:"object", required:true},
                index: {type:"number", required:true},
                source: {type:"string", required:true}
            },
            bubbles: true,
            composed: true
        }
    },
    properties: {
        view:       {type:"string", default:"list", attribute:true, state:true, enum:["list", "details", "icons", "tiles"], description:"Current presentation view."},
        views:      {type:"string", default:"", attribute:true, state:true, description:"Comma-separated list of views available in the built-in selector."},
        multiple:   {type:"boolean", default:false, attribute:true, state:true, description:"Whether more than one item can be selected."},
        autoScroll: {type:"boolean", default:false, attribute:true, state:true, description:"Whether to scroll to the newest item when the collection grows."}
    },
    methods: {},
    slots: {
        "": {
            description: "A list-view head followed by a list-view body."
        }
    }
};


// implementation
export default {
    style: `
        :host { 
            display: flex;
            position: relative;
            width: 100%;
            min-width: 0;
            --x-listview-grid-template-columns: minmax(0, 1fr);
            --x-listview-view: 'details';
        }
        :host([hidden]) {display:none!important;}

        /* x-dropdown */
        x-dropdown {}

        /* items */
        .items {flex:1;}
        .items:focus {
            outline:none;
            --x-listview-item-selected-border: .1em var(--x-color-gray) dotted;
        }
    `,
    template: `
        <div ref="items" tabIndex="0" class="items" x-attr:aria-multiselectable="state.multiple ? 'true' : null" x-on:click="click" x-on:dblClick="dblClick">
            <slot x-on:slotchange="refresh" ></slot>
        </div>

        <x-dropdown class="menu left" x-if="state.availableViews.length > 1">
            <x-button x-attr:icon="'x-listview-' + state.view" class="menuitem" tooltip="Change view"></x-button>
            <div slot="dropdown">
                <x-menuitem x-for="view in state.availableViews"
                    x-attr:data-view="view"
                    x-class:selected="view == state.view"
                    x-attr:icon="'x-listview-' + view"
                    x-attr:label="view"
                    x-attr:title="view"
                    class="menuitem"
                    x-on:click="changeView"
                ></x-menuitem>
            </div>
        </x-dropdown>
    `,
    state: {
        availableViews: []
    },
    controller({ state, events, host, timer }) {
        const supportedViews = ["list", "details", "icons", "tiles"];
        return {
            load() {
                // load
                host.addEventListener("keydown", (event) => {this.keydown({event});});
                host.addEventListener("focusin", (event) => {this.focus();});
                events.on(state, "change:view", "refreshView");
                events.on(state, "change:views", "refreshViews");
                events.on(state, "change:multiple", "multipleChanged");
                // detect changes in light dom
                this.mutationObserver = new MutationObserver(()=>{
                    this.refresh();
                });
                this.mutationObserver.observe(host, {
                    childList: true,
                    attributes: true,
                    attributeFilter: ["width", "category"],
                    subtree: true
                });
            },
            async focus() {
                timer.setTimeout(() => {
                    let items = host.querySelectorAll(":scope > x-listview-body > x-listview-item");
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
            changeView(args) {
                const view = args.event.currentTarget.dataset.view;
                if (state.availableViews.includes(view)) state.view = view;
            },
            refreshViews() {
                const configuredViews = String(state.views || "").split(",").map(view => view.trim().toLowerCase()).filter(view => supportedViews.includes(view));
                state.availableViews = [...new Set(configuredViews)];
                this.refreshView();
            },

            refreshView() {
                let view = String(state.view || "").trim().toLowerCase();
                if (!supportedViews.includes(view)) view = "list";
                if (state.availableViews.length && !state.availableViews.includes(view)) {
                    view = state.availableViews[0];
                }
                if (state.view !== view) state.view = view;
                this.refresh({scroll:false});
            },
            multipleChanged() {
                if (!state.multiple) {
                    const items = [...host.querySelectorAll(":scope > x-listview-body > x-listview-item")];;
                    const selectedItems = items.filter(item => item.selected);
                    selectedItems.slice(1).forEach(item => { item.selected = false; });
                }
            },
            refresh(args = {}) {
                // determine grid template columns for details view
                const columns = host.querySelectorAll(":scope > x-listview-head > x-listview-column");
                const gridTemplateColumns = [...columns]
                    .map(column => column.getAttribute("width")?.trim() || "minmax(0, 1fr)")
                    .join(" ");
                if (gridTemplateColumns) {
                    host.style.setProperty("--x-listview-grid-template-columns", gridTemplateColumns);
                } else {
                    host.style.removeProperty("--x-listview-grid-template-columns");
                }
                // view
                let view = supportedViews.includes(state.view) ? state.view : "list";
                host.style.setProperty("--x-listview-view", "'" + view + "'");

                // category
                const items = [...host.querySelectorAll(":scope > x-listview-body > x-listview-item")];
                let previousCategory = null;
                items.forEach((item, index) => {
                    const category = item.getAttribute("category") ?? item.category ?? "";
                    const categoryVisible = (view === "list" || view === "details") && category !== "" && category !== previousCategory;
                    item.toggleAttribute("data-category-visible", categoryVisible);
                    item.selected = false;
                    item.index = index;
                    previousCategory = category;
                });

                // scroll to newest item if needed
                const previousItemCount = this.lastItemCount ?? items.length;
                this.lastItemCount = items.length;
                if (args.scroll && items.length > previousItemCount) {
                    const item = items.at(-1);
                    if (!item || !state.autoScroll || (host.checkVisibility && !host.checkVisibility())) return;
                    if (this.autoScrollTimer) clearTimeout(this.autoScrollTimer);
                    this.autoScrollTimer = setTimeout(() => {
                        item.scrollIntoView({block:"end", behavior:"smooth"});
                        delete this.autoScrollTimer;
                    }, 25);
                }
            },
            async dblClick(args) {
                // dblClick
                let event = args.event;
                let item = event.target.closest("x-listview-item");
                if (item) {
                    item.dispatchEvent(new CustomEvent("activate", {bubbles: true, detail: {path: item.path}}));
                }
            },
            async click(args) {
                // click
                let event = args.event;
                let item = event.target.closest("x-listview-item");
                if (item) {
                    if (state.multiple) {
                        item.selected = !item.selected;
                    } else {
                        let items = host.querySelectorAll("x-listview-item");
                        items.forEach((item) => {
                            item.selected = false;
                        });
                        item.selected = true;
                    }
                    item.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: item.path}}));
                }
                // focus if required
                if (!document.activeElement || document.activeElement.localName == "body") {
                    host.shadowRoot.querySelector('[ref="items"]').focus();
                }
            },
            getEventItem(event) {
                const path = event.composedPath?.() || [];
                const fromPath = path.find(element => element?.localName === "x-listview-item");
                return fromPath || event.target?.closest?.("x-listview-item") || null;
            },
            async keydown(args) {
                let event = args.event;
                // get visible items
                const items = [...host.querySelectorAll(":scope > x-listview-body > x-listview-item")];
                // get selected items
                let selected = null;
                let selecteds = [];
                for(let target of items) {
                    if (target.selected) {
                        selecteds.push(target);
                        selected = target;
                    }
                }
                let pageSize = 10;
                // process key
                let newSelecteds = null;
                if (event.key == "ArrowUp") {
                    let index = items.indexOf(selected);
                    if (index > 0) {
                        newSelecteds = [items[index-1]];
                        selected.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: items[index-1].path}}));
                    }
                    event.preventDefault();
                } else if (event.key == "ArrowDown") {
                    let index = items.indexOf(selected);
                    if (index < items.length - 1) {
                        newSelecteds = [items[index+1]];
                        selected.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: items[index+1].path}}));
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
                } else if (event.key == "Enter") {
                    if (selected) {
                        selected.expanded = !selected.expanded;
                        selected.dispatchEvent(new CustomEvent("activate", {bubbles: true, detail: {path: selected.path}}));
                    }
                    event.preventDefault();
                }
                // reselect
                if (newSelecteds) {
                    selecteds.forEach((item) => { item.selected = false; });
                    newSelecteds.forEach((item) => { item.selected = true; });
                }
            }
        };
    }
};
