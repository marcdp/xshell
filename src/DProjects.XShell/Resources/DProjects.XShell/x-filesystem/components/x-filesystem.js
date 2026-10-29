import * as PathUtils from "../utils/path.js";

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
            <x-button icon="x-arrow-back" x-on:click="onBack" x-attr:disabled="state.historyIndex <= 0" class="menuitem"></x-button>
            <x-button icon="x-arrow-forward" x-on:click="onForward" x-attr:disabled="state.historyIndex >= state.history.length - 1" class="menuitem"></x-button>
            <x-button icon="x-arrow-up" x-on:click="onUp" class="menuitem" x-attr:disabled="state.pathList == state.path"></x-button>
            <x-button icon="x-refresh" x-on:click="onRefresh" class="menuitem" ></x-button>
            <x-datafield x-model="state.pathList" type="string" label="" placeholder="path" readonly style="flex:1"></x-datafield>        
        </x-toolbar>

        <div class="container" x-on:contextmenuentry="onContextMenuEntry"> 

            <x-filesystem-tree 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.path" 
                x-on:select="onTreeSelect"
                x-on:toggle="onTreeToggle"
                x-on:properties="onTreeProperties"
                x-on:rename="onTreeRename"
                x-on:delete="onTreeDelete"
                x-attr:root="state.root"
            ></x-filesystem-tree>

            <x-splitter></x-splitter>

            <x-filesystem-list 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.pathList || state.path" 
                x-on:select="onListSelect"
                x-on:activate="onListActivate"
                x-on:back="onListBack"
                x-on:properties="onListProperties"
                x-on:rename="onListRename"
                x-on:delete="onListDelete"
                x-on:upload="onListUpload"
            ></x-filesystem-list>

        </div>

        <x-contextmenu x-on:command="onCommand">        
            <x-menuitem label="Open" icon="x-open" command="open" x-attr:disabled="!state.entry"></x-menuitem>
            <x-menuitem label="-" ></x-menuitem>
            <x-menuitem label="New File ..." icon="x-file" command="newFile" x-attr:disabled="(state.entry && state.entry.type != 'directory' ? true : false)"></x-menuitem>
            <x-menuitem label="New Folder ..." icon="x-folder" command="newFolder" x-attr:disabled="(state.entry && state.entry.type != 'directory' ? true : false)"></x-menuitem>
            
            <!--<x-menuitem label="Refresh" icon="x-refresh" command="refresh" x-attr:disabled="!state.entry && state.entry.type == 'directory'"></x-menuitem>-->
            <x-menuitem label="Upload Files ..." icon="x-file" command="uploadFiles" x-attr:disabled="(state.entry && state.entry.type != 'directory' ? true : false)"></x-menuitem>
            <x-menuitem label="-" ></x-menuitem>
            <x-menuitem label="Rename" icon="x-rename" command="rename" x-attr:disabled="(!state.entry || state.entry.path == state.path ? true : false)"></x-menuitem>
            <x-menuitem label="Delete" icon="x-trash" command="delete" x-attr:disabled="(!state.entry || state.entry.path == state.path ? true : false)"></x-menuitem>
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
            async refresh( options = {} ) {
                // handle refresh event
                console.log("refresh");
                const list = host.shadowRoot.querySelector("x-filesystem-list");
                const tree = host.shadowRoot.querySelector("x-filesystem-tree");
                if (list) await list.refresh( options ); 
                if (tree) await tree.refresh( options );
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
            async newFile(path) {
                // newFile
                if (!path) return;
                const result = await dialog.prompt({
                    title: "New file",
                    label: "New name",
                    message: "Create a new file in " + path,
                    value: "New file.txt"
                });
                if (result) {
                    if (!await this.validateName(result)) return;
                    const newPath = PathUtils.combine(path, result);
                    const exists = await state.filesystem.exists(newPath);
                    if (exists) {
                        dialog.message({title: "Error", type:"error", message: "A file with the name " + result + " already exists."});
                        return;
                    }
                    // create the new file
                    await state.filesystem.saveFile(newPath, "");
                    // refresh the view
                    this.refresh( { selectedPath: newPath } );
                }
            },
            async newFolder(path) {
                // newFolder
                if (!path) return;
                const result = await dialog.prompt({
                    title: "New Folder",
                    label: "New name",
                    message: "Create a new folder in " + path,
                    value: "New Folder"
                });
                if (result) {
                    if (!await this.validateName(result)) return;
                    const newPath = PathUtils.combine(path, result);
                    const exists = await state.filesystem.exists(newPath);
                    if (exists) {
                        dialog.message({title: "Error", type:"error", message: "A folder with the name " + result + " already exists."});
                        return;
                    }
                    // create the new directory
                    await state.filesystem.createDirectory(newPath);
                    // refresh the view
                    this.refresh( { selectedPath: newPath } );
                }
            },
            async showUploadFiles(path) {
                if (!path) return;
                const handles = await window.showOpenFilePicker({multiple:true});
                for (const handle of handles) {
                    const file = await handle.getFile();
                    console.log(file.name);
                }
                await this.uploadFiles(path, handles);
            },
            async uploadFiles(path, files) {
                // async open({ href, params, title, breadcrumb, icon, context }) {
                if (!path) return;
                const result = await dialog.open({
                    href: "page:x-filesystem:/pages/upload.js",
                    params: {},
                    context: {
                        filesystem: state.filesystem,
                        src: state.src,
                        path: state.pathList,
                        filePath: path,
                        files: files || []
                    }
                });
                // refresh the view
                if (result) {
                    for (const item of result) {
                        if (item.status === "ok") {
                            this.refresh( { selectedPath: item.path } );
                            break;
                        }
                    }
                }
            },
            async rename(path) {
                // rename
                if (path == null || path === state.path) return;
                const name = path.split("/").pop();
                const result = await dialog.prompt({
                    title: "Rename",
                    label: "New name",
                    message: "Rename " + path,
                    value: name
                });
                if (result && result !== name) {
                    // validate
                    if (!await this.validateName(result)) return;
                    // check if the new path already exists
                    const newPath = path.split("/").slice(0, -1).concat(result).join("/");
                    const exists = await state.filesystem.exists(newPath);
                    if (exists) {
                        dialog.message({title: "Error", type:"error", message: "A file or folder with the name " + result + " already exists."});
                        return;
                    }
                    // move the file to the new path
                    await state.filesystem.move(path, newPath);
                    // change from historic
                    for(var i = state.history.length - 1; i >= 0; i--) {
                        if (state.history[i] === path) {
                            state.history[i] = newPath;
                        }
                    }
                    // refresh the view after moving the file
                    this.refresh( { selectedPath: newPath } );
                }
            },
            async delete(path) {
                // delete
                if (path == null || path === state.path) return;
                const result = await dialog.confirm({
                    title: "Delete",
                    message: "Are you sure you want to delete " + path + "?"
                });
                if (result) {
                    // delete
                    await state.filesystem.delete(path);
                    // remove from historic
                    for(var i = state.history.length - 1; i >= 0; i--) {
                        if (state.history[i] === path) {
                            state.history.splice(i, 1);
                            if (state.historyIndex >= state.history.length) {
                                state.historyIndex = state.history.length - 1;
                            }
                        }
                    }
                    // refresh
                    this.refresh();
                }
            },
            async validateName(path) {
                // validate the name
                try {
                    PathUtils.validateName(path);
                } catch (error) {
                    await dialog.message({title: "Invalid name", type:"error", message: error.message});
                    return false;
                }
                return true;
            },


            /* commands */
            onCommand({event}) {                
                if (event.detail.command === "open") {
                    this.open();
                } else if (event.detail.command === "refresh") {
                    this.refresh( {selectedPath: state.pathList} );
                } else if (event.detail.command === "delete") {
                    if (state.entry) this.delete(state.entry.path);
                } else if (event.detail.command === "properties") {
                    this.properties();
                } else if (event.detail.command === "newFile") {
                    this.newFile(state.entry?.path ?? state.pathList);
                } else if (event.detail.command === "newFolder") {
                    this.newFolder(state.entry?.path ?? state.pathList);
                } else if (event.detail.command === "uploadFiles") {
                    this.showUploadFiles(state.entry?.path ?? state.pathList);
                } else if (event.detail.command === "rename") {
                    if (state.entry) this.rename(state.entry.path);
                } else {
                    alert("UNHANDLED COMMAND: " + event.detail.command)
                }
            },
            onRefresh({event}) {
                this.refresh( {selectedPath: state.pathList} );
            },
            async onBack() {
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
            async onForward() {
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
            onUp() {
                // handle up 
                const path = state.pathList;
                if (path != "/") {
                    const newPath = path.split("/").slice(0, -1).join("/") || "/";
                    this.navigateTo(newPath);
                }
            },

            /* tree */
            onTreeSelect({event}) {
                // handle tree select event
                if (event.detail.sourceEvent instanceof KeyboardEvent) return
                this.navigateTo(event.detail.path, {expand: false, select: true});
            },
            onTreeToggle({ event }) {
                // handle tree toggle event
            },
            onTreeProperties({event}) {
                // handle tree properties event
                this.properties(event.detail.entry.path);
            },
            onTreeRename({event}) {
                // handle tree rename event
                this.rename(event.detail.entry.path);
            },
            onTreeDelete({event}) {
                // handle tree delete event
                this.delete(event.detail.entry.path);
            },

            /* list */
            onListSelect({event}) {
                // handle list select event
            },
            onListActivate({event}) {
                // handle list activate event
                this.open(event.detail.entry)
            },
            onListBack({event}) {
                // handle list back event
                this.onUp({event});
            },
            onListProperties({event}) {
                // handle list properties event
                this.properties(event.detail.entry);
            },
            onListRename({event}) {
                // handle list rename event
                this.rename(event.detail.entry.path);
            },
            onListDelete({event}) {
                // handle list delete event
                this.delete(event.detail.entry.path);
            },
            onListUpload({event}) {
                // handle list upload event
                this.uploadFiles(event.detail.path, event.detail.files);
            },

            /* context menu */
            onContextMenuEntry({event}) {
                // handle context menu entry event
                state.entry = event.detail.entry;
                console.log(state.entry);
                const contextMenu = host.shadowRoot.querySelector("x-contextmenu");
                contextMenu.open({x: event.detail.x, y: event.detail.y});
            }
        }
    }
};

    