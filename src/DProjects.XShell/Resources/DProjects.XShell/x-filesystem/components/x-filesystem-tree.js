
// contract
export const contract = {
    description: "Filesystem tree component",
    events: {
        contextmenuentry: {
            description: "Fired when a context menu is requested for an entry",
            detail: {
                path: {type: "string", description: "Path of the entry"},
                entry: {type: "object", description: "Entry object"},
                source: {type: "string", description: "Source of the event (tree)"},
                x: {type: "number", description: "X coordinate of the context menu request"},
                y: {type: "number", description: "Y coordinate of the context menu request"}
            }
        }
    },
    properties: {
        path: {type: "string", default:"/", attribute: true, state:true, description: "Current path in the filesystem"},
        filesystem: {type: "object", default:null, state:true, description: "Filesystem instance"},
        root: {type:"boolean", default:false, attribute: true, state: true, description: "Indicates if the root folder should be displayed"}
    },
    methods: {
        select: {
            description: "Select a tree item by path",
            parameters: [
                {name: "path", type: "string", description: "Path of the tree item to select"}
            ]
        },
        expand: {
            description: "Expand a tree item by path",
            parameters: [
                {name: "path", type: "string", description: "Path of the tree item to expand"}
            ] 
        }, 
        collapse: {
            description: "Collapse a tree item by path",
            parameters: [
                {name: "path", type: "string", description: "Path of the tree item to collapse"}
            ] 
        }
    },
    slots: {}
};


// implementation
export default {
    style: `
        :host {width:100%;}
    `,
    template: `
        <x-treeview x-on:toggle="toggle" x-on:select="selectTreeviewItem" x-on:contextmenuitem="contextMenuItem" x-on:keydown="keydown">

            <x-treeview-head>
                <x-treeview-column label="Name"></x-treeview-column>
            </x-treeview-head>

            <x-treeview-body x-if="state.entries">
                <x-treeview-item x-recursive="entry in state.entries" x-key="path" 
                    x-attr:label="entry.name"
                    x-attr:icon="entry.icon"
                    x-attr:path="entry.path"
                    x-attr:expanded="entry.expanded"
                    x-attr:has-childs-forced="entry.hasChildsForced"                    
                    x-class:loading="entry.loading"
                >
                </x-treeview-item>
            </x-treeview-body>

        </x-treeview>
    `,
    state: {
        filesystem: null,
        path: "/",        
        selectedPath: null,
        entries: null,
        root: false
    },
    controller({ state, events, host }) {
        return {
            async load(args) {
                // load
                events.on(state, ["change:path", "change:filesystem", "change:root"], "loadRootEntries");                
            },
            async mount(){
                await this.loadRootEntries();
            },
            async loadRootEntries() {
                // refresh
                if (state.filesystem && state.path) {
                    const entries = [];
                    // iterate over filesystem entries and collect them into an array
                    for await (const entry of state.filesystem.getEntries(state.path)) {
                        if (entry.type === "directory") {
                            entries.push({
                                ...entry,
                                hasChildsForced: true,
                                expanded: false,
                                children: undefined,
                                icon: "x-folder"
                            });
                        }
                    }
                    // sort entries by name
                    entries.sort((a, b) => {
                        return a.name.localeCompare(b.name);
                    });
                    // set
                    if (state.root) {
                        const root = { 
                            expanded:true, 
                            icon: "x-root", 
                            children: entries,
                            ... await state.filesystem.getEntry(state.path) 
                        };
                        state.entries = [root];
                    } else {
                        state.entries = entries;
                    }
                }
            },
            async loadChildEntries(path) {
                // refresh
                if (state.filesystem && path) {
                    const entry = this.getEntryByPathRecursive(path);
                    // loading
                    entry.loading = true;
                    host.invalidate();
                    // iterate over filesystem entries and collect them into an array
                    const entries = [];
                    for await (const entry of state.filesystem.getEntries(path, {mode: state.filesystem.constructor.GetModes.Directories})) {
                        if (entry.type === "directory") {
                            entries.push({
                                ...entry,
                                hasChildsForced: true,
                                children: undefined,
                                expanded: false,
                                icon: "x-folder"
                            });
                        }
                    }
                    // sort entries by name
                    entries.sort((a, b) => {
                        return a.name.localeCompare(b.name);
                    });
                    // set
                    entry.hasChildsForced = entries.length > 0;
                    entry.children = entries;
                    entry.loading = false;
                    host.invalidate();
                }
            },
            async select(path) {
                // focus the tree item corresponding to the given path
                const treeview = host.shadowRoot.querySelector("x-treeview");
                const entry = this.getEntryByPathRecursive(path);
                if (entry) {
                    state.selectedPath = path;
                    if (treeview) treeview.select(path);
                    host.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: entry.path}}));
                }
            },
            async expand(path) {
                // only expand if children are not already loaded
                const entry = this.getEntryByPathRecursive(path);
                if (entry && !entry.expanded) {
                    if (entry.children === undefined) {
                        await this.loadChildEntries(entry.path);
                    }
                    entry.expanded = true;
                    host.invalidate();
                }
            },
            collapse(path) {
                const entry = this.getEntryByPathRecursive(path);
                if (entry && entry.expanded) {
                    entry.expanded = false;
                    host.invalidate();
                }
            },
            async clear() {
                const treeview = host.shadowRoot.querySelector('x-treeview');
                if (treeview) treeview.clear();
            },

            /* events */
            async selectTreeviewItem({event}) {
                const path = event.detail.path;                
                this.select(path);
            },
            async toggle({event}){
                // toggle
                const entry = this.getEntryByPathRecursive(event.detail.path);
                if (!entry.expanded) {
                    this.expand(entry.path)
                } else {
                    this.collapse(entry.path)
                }
                host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: event.detail.path}}));
            },
            getEntryByPathRecursive(path) {
                const findEntry = (entries, path) => {
                    for (const entry of entries) {
                        if (entry.path === path) {
                            return entry;
                        }
                        if (entry.children && entry.children.length > 0) {
                            const found = findEntry(entry.children, path);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                return findEntry(state.entries, path);  
            },
            async contextMenuItem({event}) {
                const entry = this.getEntryByPathRecursive(event.detail.path);
                event.preventDefault();
                host.dispatchEvent(new CustomEvent("contextmenuentry", {
                    bubbles: true,
                    composed: true,
                    cancelable: true,
                    detail: {
                        path: event.detail.path,
                        entry,
                        source: "list", // or "tree"
                        x: event.detail.x,
                        y: event.detail.y
                    }
                }));
            },
            async keydown({event}){
                if (event.key === "Enter" && event.altKey) {
                    const entry = this.getEntryByPathRecursive(state.selectedPath);
                    host.dispatchEvent(new CustomEvent("properties", {bubbles: true, detail: {path: state.selectedPath, entry}}));
                    event.preventDefault();
                }
            },

        }
    }
};

