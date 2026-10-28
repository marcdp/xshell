
// contract
export const contract = {
    description: "Filesystem component",
    events: {},
    properties: {
        path: {type: "string", default:"/", attribute: true, state:true, description: "Current path in the filesystem"},
        src: {type: "string", default:null, attribute: true, state:true, description: "Source of the filesystem (e.g., 'mem:')"},
        filesystem: {type: "object", default:null, attribute: false, state:true, description: "Filesystem instance"},
        root: {type:"boolean", default:false, attribute: true, state: true, description: "Indicates if the root folder should be displayed"}
    },
    methods: {},
    slots: {}
};


// implementation
export default {
    style: `
        :host {display:block;}
        .container {display:flex; width:100%; min-width:0; margin-top:.5em; }
        .container x-filesystem-tree {flex:0 0 20%; min-width:12rem; max-width:calc(100% - 28rem - .15em); padding:.5em; padding-top:0; box-sizing:border-box;}
        .container x-filesystem-list {flex:1 1 0; min-width:28rem; padding:.5em; padding-top:0; box-sizing:border-box;}
    `,
    template: `
        <x-toolbar>
            <x-button icon="x-arrow-back" x-on:click="back" x-attr:disabled="state.historyIndex <= 0" class="menuitem"></x-button>
            <x-button icon="x-arrow-forward" x-on:click="forward" x-attr:disabled="state.historyIndex >= state.history.length - 1" class="menuitem"></x-button>
            <x-button icon="x-arrow-up" x-on:click="up" class="menuitem" x-attr:disabled="state.pathList == state.path"></x-button>
            <x-button icon="x-refresh" x-on:click="refresh" class="menuitem" ></x-button>
            <x-datafield x-model="state.pathList" type="string" label="" placeholder="path" readonly style="flex:1"></x-datafield>        
        </x-toolbar>

        <div class="container" x-on:contextmenuentry="contextMenuEntry"> 

            <x-filesystem-tree 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.path" 
                x-on:select="treeSelect"
                x-on:toggle="treeToggle",
                x-on:properties="treeProperties"
                x-on:rename="treeRename"
                x-attr:root="state.root"
            ></x-filesystem-tree>

            <x-splitter></x-splitter>

            <x-filesystem-list 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.pathList || state.path" 
                x-on:select="listSelect"
                x-on:activate="listActivate"
                x-on:back="listBack"
                x-on:properties="listProperties"
                x-on:rename="listRename"
            ></x-filesystem-list>

        </div>

        <x-contextmenu x-on:command="command">
            <x-menuitem label="Open" icon="x-open" command="open" x-attr:disabled="!state.entry"></x-menuitem>
            <x-menuitem label="-" ></x-menuitem>
            <x-menuitem label="New File ..." icon="x-file" command="newFile"></x-menuitem>
            <x-menuitem label="New Folder ..." icon="x-folder" command="newFolder"></x-menuitem>
            <!--<x-menuitem label="Refresh" icon="x-refresh" command="refresh" x-attr:disabled="!state.entry && state.entry.type == 'directory'"></x-menuitem>-->
            <x-menuitem label="-" ></x-menuitem>
            <x-menuitem label="Rename" icon="x-rename" command="rename" x-attr:disabled="!state.entry"></x-menuitem>
            <x-menuitem label="Delete" icon="x-trash" command="delete" x-attr:disabled="!state.entry"></x-menuitem>
            <x-menuitem label="-" ></x-menuitem>
            <x-menuitem label="Properties" icon="x-wrench" command="properties" x-attr:disabled="!state.entry"></x-menuitem>
        </x-contextmenu>
    `,
    state: {
        src: null,
        filesystem: null,
        path: "/",
        pathList: "/",
        entry: null,
        history: ["/"],
        historyIndex: 0,
        root: false
    },
    controller({ state, events, loader, navigation, getPage, host, dialog}) {
        return {
            async load(args) {
                // load
                if (typeof state.pathList === "string" && state.pathList) {
                    state.history = [state.pathList];
                    state.historyIndex = 0;
                }
                events.on(state, "change:src", async (event)=>{
                    state.history = [state.pathList];
                    state.historyIndex = 0;
                    state.filesystem = await loader.load("filesystem:" + state.src);
                })
            },

            // commands
            command({event}) {
                
                if (event.detail.command === "open") {
                    this.open();
                } else if (event.detail.command === "refresh") {
                    this.refresh();
                } else if (event.detail.command === "newFolder") {
                } else if (event.detail.command === "delete") {
                } else if (event.detail.command === "properties") {
                    this.properties();
                } else if (event.detail.command === "newFile") {
                    this.newFile();
                } else if (event.detail.command === "rename") {
                    if (state.entry) this.rename(state.entry.path);
                } else {
                    alert("UNHANDLED COMMAND: " + event.detail.command)
                }
            },
            async refresh() {
                // handle refresh event
                const list = host.shadowRoot.querySelector("x-filesystem-list");
                await list.refresh();
            },
            async back() {
                // handle back event
                if (state.historyIndex > 0) {
                    state.historyIndex--;
                    state.pathList = state.history[state.historyIndex];
                    const tree = host.shadowRoot.querySelector("x-filesystem-tree");
                    if (tree) {
                        await tree.expand(state.pathList);
                        await tree.select(state.pathList);
                    }
                }
            },
            async forward() {
                // handle forward event
                if (state.historyIndex < state.history.length - 1) {
                    state.historyIndex++;
                    state.pathList = state.history[state.historyIndex];
                    const tree = host.shadowRoot.querySelector("x-filesystem-tree");
                    if (tree) {
                        await tree.expand(state.pathList);
                        await tree.select(state.pathList);
                    }
                }
            },
            async navigateTo(path, {expand = true, select = true} = {}) {
                if (typeof path !== "string" || !path || path === state.pathList) return;
                state.history = [...state.history.slice(0, state.historyIndex + 1), path];
                state.historyIndex = state.history.length - 1;
                state.pathList = path;
                const tree = host.shadowRoot.querySelector("x-filesystem-tree");
                if (tree) {
                    if (expand) await tree.expand(path);
                    if (select) await tree.select(path);
                }
            },
            up() {
                // handle up 
                const path = state.pathList;
                if (path != "/") {
                    const newPath = path.split("/").slice(0, -1).join("/") || "/";
                    this.navigateTo(newPath);
                }
            },
            open(entry = state.entry) {
                // open
                if (entry && entry.type === "directory") {
                    this.navigateTo(entry.path);
                } else {
                    const page = getPage();
                    navigation.navigate( {
                        href: "page:x-filesystem:/pages/edit.js",
                        page: page,
                        params: {
                            src: state.src,
                            path: entry.path,
                        },
                        open: "stack"
                    });
                }
            },
            properties(entry = state.entry) {
                // open
                const page = getPage();
                navigation.navigate( {
                    href: "page:x-filesystem:/pages/properties.js",
                    page: page,
                    params: {
                        src: state.src,
                        path: entry.path,
                    },
                    open: "stack"
                });
            },
            async newFile() {
                // async open({ href, params, title, breadcrumb, icon, context }) {
                const result = await dialog.open({
                    href: "page:x-filesystem:/pages/new-file.js",
                    params: {},
                    context: {
                        src: state.src,
                        path: state.pathList
                    }
                });
            },            
            async rename(path) {
                // rename
                if (path == null || path === state.path) return;
                const result = await dialog.prompt({
                    title: "Rename",
                    label: "New name",
                    value: path.split("/").pop()
                });
                alert(result)
            },


            /* tree */
            treeSelect({event}) {
                // handle tree select event
                if (event.detail.sourceEvent instanceof KeyboardEvent) return
                this.navigateTo(event.detail.path, {expand: false, select: true});
            },
            treeToggle({ event }) {
                // handle tree toggle event
            },
            treeProperties({event}) {
                // handle tree properties event
                this.properties(event.detail.entry.path);
            },
            treeRename({event}) {
                // handle tree rename event
                this.rename(event.detail.entry.path);
            },

            /* list */
            listSelect({event}) {
                // handle list select event
            },
            listActivate({event}) {
                // handle list activate event
                this.open(event.detail.entry)
            },
            listBack({event}) {
                // handle list back event
                this.up();
            },
            listProperties({event}) {
                // handle list properties event
                this.properties(event.detail.entry);
            },
            listRename({event}) {
                // handle list rename event
                this.rename(event.detail.entry.path);
            },

            /* context menu */
            contextMenuEntry({event}) {
                // handle context menu entry event
                state.entry = event.detail.entry;
                const contextMenu = host.shadowRoot.querySelector("x-contextmenu");
                contextMenu.open({x: event.detail.x, y: event.detail.y});
            }
        }
    }
};

    