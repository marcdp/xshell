

// contract
export const contract = {
    description: "Filesystem list component",
    events: {
        select: {description: "Fired when an item is selected"},
        activate: {description: "Fired when an item is activated"},
        back: {description: "Fired when the back action is triggered"},
        properties: {description: "Fired when the properties action is triggered"},
        rename: {description: "Fired when the rename action is triggered"},
        delete: {description: "Fired when the delete action is triggered"},
        upload: {
            description: "Fired when files are uploaded",
            detail: {
                path: {type: "string", description: "Path where files are uploaded"},
                files: {type: "array", description: "List of uploaded files"}
            }
        },
        contextmenuentry: {
            description: "Fired when a context menu entry is requested",
            detail: {
                path: {type: "string", description: "Path of the item"},
                entry: {type: "object", description: "The filesystem entry"},
                source: {type: "string", description: "Source of the context menu request"},
                x: {type: "number", description: "X coordinate of the context menu"},
                y: {type: "number", description: "Y coordinate of the context menu"}
            }
        }
    },
    properties: {
        path: {type: "string", default:"/", attribute: true, state:true, description: "Current path in the filesystem"},
        filesystem: {type: "object", default:null, state:true, description: "Filesystem instance"}
    },
    methods: {
        refresh: {
            description: "Refresh the list for the current path",
            parameters: [
                { name: "options", type: "object", description: "Options for refreshing the list", schema: {
                    type: "object",
                    properties: {
                        selectedPath: {type: "string", description: "Path of the selected item"}                        
                    }
                }}
            ]
        },
    },
    slots: {}
};


// implementation
export default {
    style: `
        :host {width:100%;}
        x-listview {height:100%;}
    `,
    template: `
        <x-listview view="details" views="list, details, tiles, icons" x-class:drag-over="state.dragOver" x-on:select="onSelect" x-on:activate="onActivate" x-on:keydown="onKeydown" x-on:contextmenuitem="onContextMenuItem" x-on:dragenter="onDragEnter" x-on:dragover="onDragOver" x-on:dragleave="onDragLeave" x-on:dragend="onDraEnd" x-on:drop="onDrop" >
            <x-listview-head>
                <x-listview-column label="Name"></x-listview-column>
                <x-listview-column label="Size" width="6em" style="text-align:right; padding-right:0.5em;"></x-listview-column>
                <x-listview-column label="Created" width="6em"></x-listview-column>
                <x-listview-column label="Modified" width="6em"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
                <x-listview-item x-for="entry in state.entries"
                    x-attr:href="entry.url" 
                    x-attr:label="entry.name"
                    x-attr:icon="entry.icon"
                    x-attr:path="entry.path" 
                    target="_blank"
                >
                    <x-file-size style="text-align:right; padding-right:0.5em" x-prop:value="entry.length"></x-file-size>
                    <x-datetime x-prop:value="entry.created"></x-datetime>
                    <x-datetime x-prop:value="entry.modified"></x-datetime> 
                </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        filesystem: null,
        path: "/",
        entries: [],
        selectedPath: null,
        dragOver: false,
    },
    controller({ state, events, host, commands }) {
        return {
            async load(args) {
                // load
                events.on(state, ["change:path", "change:filesystem"], "refresh");
                events.on(state, ["change:search_name"], "filter");
                if (state.path) this.refresh();
            },
            async refresh( { selectedPath } = {} ) {
                if (state.filesystem && state.path) {
                    // check if the host has focus before refreshing
                    const hasFocus = host.matches(':focus-within');
                    // iterate over filesystem entries and collect them into an array
                    const entries = [];
                    for await (const entry of state.filesystem.getEntries(state.path)) {
                        entries.push({
                            ...entry,
                            icon: (entry.type === "directory" ? "x-folder" : "x-file")
                        });
                    }
                    // sort entries by name (first directories, then files)
                    entries.sort((a, b) => {
                        if (a.type === "directory" && b.type !== "directory") return -1;
                        if (a.type !== "directory" && b.type === "directory") return 1;
                        return a.name.localeCompare(b.name);
                    });
                    // set
                    state.entries = entries;
                    // clear selection
                    this.clear();
                    // select
                    if (selectedPath) {
                        const entry = state.entries.find(e => e.path === selectedPath) || null;
                        if (entry) {
                            state.selectedPath = selectedPath;
                            host.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: selectedPath, entry}}));
                            commands.enqueue("select", selectedPath);
                        }
                    }
                    // if previously focused, try to restore focus to the list items
                    if (hasFocus) {
                        commands.enqueue("focus");                        
                    }
                }
            },
            select(path) {
                const listview = host.shadowRoot.querySelector('x-listview');
                if (listview) listview.select(path);
            },
            async focus() {
                const listview = host.shadowRoot.querySelector('x-listview');
                if (listview) listview.focus();
            },
            async clear() {
                const listview = host.shadowRoot.querySelector('x-listview');
                if (listview) listview.clear();
            },

            // event handlers
            async onSelect({event}){
                // select
                state.selectedPath = event.detail.path;
                const entry = state.entries.find(e => e.path === event.detail.path) || null;
                host.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: event.detail.path, entry}}));
            },
            async onActivate({event}){
                // activate
                state.selectedPath = event.detail.path;
                const entry = state.entries.find(e => e.path === event.detail.path) || null;
                host.dispatchEvent(new CustomEvent("activate", {bubbles: true, detail: {path: event.detail.path, entry}}));
            }, 
            async onKeydown({event}){
                if (event.key === "Enter" && event.altKey) {
                    const entry = state.entries.find(e => e.path === state.selectedPath) || null;
                    host.dispatchEvent(new CustomEvent("properties", {bubbles: true, detail: {path: state.selectedPath, entry}}));
                    event.preventDefault();
                } else if (event.key === "Backspace") {
                    const entry = state.entries.find(e => e.path === state.selectedPath) || null;
                    host.dispatchEvent(new CustomEvent("back", {bubbles: true, detail: {path: state.selectedPath, entry}}));
                    event.preventDefault();
                } else if (event.key === "F2") {
                    const entry = state.entries.find(e => e.path === state.selectedPath) || null;
                    host.dispatchEvent(new CustomEvent("rename", {bubbles: true, detail: {path: state.selectedPath, entry}}));
                    event.preventDefault();
                } else if (event.key === "Delete") {
                    const entry = state.entries.find(e => e.path === state.selectedPath) || null;
                    host.dispatchEvent(new CustomEvent("delete", {bubbles: true, detail: {path: state.selectedPath, entry}}));
                    event.preventDefault();
                }
            },
            async onContextMenuItem({event}) {
                // handle context menu item selection
                const entry = state.entries.find(e => e.path === event.detail.path) || null;
                event.preventDefault();
                host.dispatchEvent(new CustomEvent("contextmenuentry", {
                    bubbles: true,
                    composed: true,
                    cancelable: true,
                    detail: {
                        path: event.detail.path,
                        entry,
                        source: "list",
                        x: event.detail.x,
                        y: event.detail.y
                    }
                }));
            },
            onDragEnter({event}) {
                if (!state.filesystem || state.filesystem.isReadonly) return;
                if (!event.dataTransfer.types.includes("Files")) return;
                state.dragOver = true;
            },
            onDragOver({event}) {
                if (!state.filesystem || state.filesystem.isReadonly) return;
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";                    
                state.dragOver = true;
            },
            onDragLeave({event}) {
                if (!state.filesystem || state.filesystem.isReadonly) return;
                if (!event.dataTransfer.types.includes("Files")) return;
                state.dragOver = false;
            },
            onDragEnd({event}) {
                state.dragOver = false;
            },
            async onDrop({event}) {
                state.dragOver = false;
                if (!state.filesystem || state.filesystem.isReadonly) return;
                if (!event.dataTransfer.types.includes("Files")) return;

                event.preventDefault();
                event.stopPropagation();

                const items = [...event.dataTransfer.items].filter(item => item.kind === "file");
                const files = items.map(item => item.webkitGetAsEntry?.() || item.getAsFile()).filter(Boolean);

                host.dispatchEvent(new CustomEvent("upload", {bubbles: true, detail: {path: state.path, files}}));
                
            }

        }
    }
};

