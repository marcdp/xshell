
// contract
export const contract = {
    description: "Filesystem component",
    events: {},
    properties: {
        path: {type: "string", default:"/", attribute: true, state:true, description: "Current path in the filesystem"},
        src: {type: "string", default:null, attribute: true, state:true, description: "Source of the filesystem (e.g., 'mem:')"}
    },
    methods: {},
    slots: {}
};


// implementation
export default {
    style: `
        :host {display:block;}
        .container {display:flex; width:100%; margin-top:.5em; }
        .container x-filesystem-tree {flex-shrink: 0; padding:.5em; padding-top:0; box-sizing:border-box;}
        .container x-filesystem-list {flex:1; padding:.5em; padding-top:0; box-sizing:border-box;}
    `,
    template: `
        <x-toolbar>
            <x-button icon="x-arrow-back" x-on:click="back" x-attr:disabled="state.historyIndex <= 0" class="menuitem"></x-button>
            <x-button icon="x-arrow-forward" x-on:click="forward" x-attr:disabled="state.historyIndex >= state.history.length - 1" class="menuitem"></x-button>
            <x-button icon="x-arrow-up" x-on:click="up" class="menuitem" x-attr:disabled="state.pathList == state.path"></x-button>
            <x-button icon="x-refresh" x-on:click="refresh" class="menuitem" ></x-button>
            <x-datafield x-model="state.pathList" type="string" label="" placeholder="path" readonly style="flex:1"></x-datafield>        
        </x-toolbar>
        <div class="container"> 
            <x-filesystem-tree 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.path" 
                x-on:select="treeSelect"
                x-on:toggle="treeToggle"
                style="width:20%"
            ></x-filesystem-tree>
            <x-splitter></x-splitter>
            <x-filesystem-list 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.pathList || state.path" 
                x-on:select="listSelect"
                x-on:activate="listActivate"
                x-on:back="listBack"
                style="width:80%"
            ></x-filesystem-list>
        </div>
    `,
    state: {
        src: null,
        filesystem: null,
        path: "/",
        pathList: "/",
        history: ["/"],
        historyIndex: 0
        
    },
    controller({ state, events, loader, navigation, getPage, host }) {
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


            /* toolbar actions */
            async refresh() {
                // handle refresh event
                const list = host.shadowRoot.querySelector("x-filesystem-list");
                await list?.onCommand("refresh");
            },
            back() {
                // handle back event
                if (state.historyIndex > 0) {
                    state.historyIndex--;
                    state.pathList = state.history[state.historyIndex];
                }
            },
            forward() {
                // handle forward event
                if (state.historyIndex < state.history.length - 1) {
                    state.historyIndex++;
                    state.pathList = state.history[state.historyIndex];
                }
            },
            navigateTo(path) {
                if (typeof path !== "string" || !path || path === state.pathList) return;
                state.history = [...state.history.slice(0, state.historyIndex + 1), path];
                state.historyIndex = state.history.length - 1;
                state.pathList = path;
            },
            up() {
                // handle up 
                const path = state.pathList;
                if (path != "/") {
                    const newPath = path.split("/").slice(0, -1).join("/") || "/";
                    this.navigateTo(newPath);
                }
            },


            /* tree */
            treeSelect({event}) {
                // handle tree select event
                const path = event.detail.path;
                this.navigateTo(path);
            },
            treeToggle({ event }) {
                // handle tree toggle event
                const path = event.detail.path;
            },


            /* list */
            listSelect({event}) {
                // handle list select event
                const path = event.detail.path;
            },
            listActivate({event}) {
                // handle list activate event
                const path = event.detail.path;
                const entry = event.detail.entry;
                if (path && entry && entry.type === "directory") {
                    this.navigateTo(path);
                } else {
                    console.log("List activate:", path);
                    const page = getPage();
                    navigation.navigate( {
                        href: "page:x-filesystem:/pages/edit.js",
                        page: page,
                        params: {
                            src: state.src,
                            path: path,
                        },
                        open: "stack"
                    });
                }
            },
            listBack({event}) {
                // handle list back event
                this.up();
            }
        }
    }
};

