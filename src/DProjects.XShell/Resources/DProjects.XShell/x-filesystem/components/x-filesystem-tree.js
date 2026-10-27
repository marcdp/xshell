
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
        filesystem: {type: "object", default:null, state:true, description: "Filesystem instance"}
    },
    methods: {},
    slots: {}
};


// implementation
export default {
    style: `
        :host {width:100%;}
    `,
    template: `
        <x-treeview x-on:toggle="toggle" x-on:select="select" x-on:contextmenuitem="contextMenuItem">

            <x-treeview-head>
                <x-treeview-column label="Name"></x-treeview-column>
            </x-treeview-head>

            <x-treeview-body x-if="state.entries">
                <x-treeview-item x-recursive="entry in state.entries" x-key="path" 
                    x-attr:label="entry.name"
                    x-attr:icon="entry.icon"
                    x-attr:path="entry.path"
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
        entries: null
    },
    controller({ state, events, host }) {
        return {
            async load(args) {
                // load
                events.on(state, ["change:path", "change:filesystem"], "refresh");
                this.refresh();
            },
            async refresh() {
                // refresh
                if (state.filesystem && state.path) {
                    const entries = [];
                    // iterate over filesystem entries and collect them into an array
                    for await (const entry of state.filesystem.getEntries(state.path)) {
                        if (entry.type === "directory") {
                            entries.push({
                                ...entry,
                                hasChildsForced: true,
                                children: [],
                                icon: "x-folder"
                            });
                        }
                    }
                    // sort entries by name
                    entries.sort((a, b) => {
                        return a.name.localeCompare(b.name);
                    });
                    // set
                    state.entries = entries;
                }
            },
            async refreshPath(path) {
                // refresh
                if (state.filesystem && path) {
                    const entry = this.getEntryByPathRecursive(path);
                    // loading
                    entry.loading = true;
                    host.invalidate();
                    // iterate over filesystem entries and collect them into an array
                    const entries = [];
                    for await (const entry of state.filesystem.getEntries(path)) {
                        if (entry.type === "directory") {
                            entries.push({
                                ...entry,
                                hasChildsForced: true,
                                children: [],
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
            async toggle({event}){
                // toggle
                await this.refreshPath(event.detail.path);
                host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {path: event.detail.path}}));
            },
            async select({event}){
                // select
                host.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: event.detail.path}}));
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
            }

        }
    }
};

