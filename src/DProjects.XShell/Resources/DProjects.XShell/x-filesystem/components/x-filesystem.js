
// contract
export const contract = {
    description: "Filesystem component",
    events: {},
    properties: {
        path: {type: "string", default:"/", attribute: true, state:true, description: "Current path in the filesystem"},
        src: {type: "string", default:"", attribute: true, state:true, description: "Source of the filesystem (e.g., 'mem:')"}
    },
    methods: {},
    slots: {}
};


// implementation
export default {
    style: `
        :host {display:block;}
        .container {display:flex; width:100%; margin-top:.5em;}
        .container x-filesystem-tree {flex-shrink: 0; padding:.5em; padding-top:0;}
        .container x-filesystem-list {flex:1; padding:.5em; padding-top:0;}
    `,
    template: `
        <x-toolbar>
            <x-button icon="x-arrow-back" x-on:click="back" class="menuitem"></x-button>
            <x-button icon="x-arrow-forward" x-on:click="forward" class="menuitem"></x-button>
            <x-button icon="x-arrow-up" x-on:click="up" class="menuitem "></x-button>
            <x-button icon="x-refresh" x-on:click="refresh" class="menuitem"></x-button>
            <x-datafield x-model="state.pathList" type="string" label="" placeholder="path" readonly style="flex:1"></x-datafield>        
        </x-toolbar>
        <div class="container"> 
            <x-filesystem-tree 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.path" 
                x-on:select="treeSelect"
                x-on:toggle="treeToggle"
                style="width:20em"
            ></x-filesystem-tree>
            <x-splitter></x-splitter>
            <x-filesystem-list 
                x-prop:filesystem="state.filesystem" 
                x-prop:path="state.pathList || state.path" 
                x-on:select="listSelect"
                x-on:toggle="listToggle"
                style="flex:1"
            ></x-filesystem-list>
        </div>
    `,
    state: {
        filesystem: null,
        path: "/",
        pathList: "/"
        
    },
    controller({ state, events, loader }) {
        return {
            async load(args) {
                // load
                events.on(state, "change:src", async (event)=>{
                    state.filesystem = await loader.load("filesystem:" + state.src);
                })
            },
            refresh({event}) {
                // handle refresh event
                console.log("Refresh clicked");
            },
            back({event}) {
                // handle back event
                console.log("Back clicked");
            },
            forward({event}) {
                // handle forward event
                console.log("Forward clicked");
            },
            up({event}) {
                // handle up event
                console.log("Up clicked");
            },
            treeSelect({event}) {
                // handle tree select event
                const path = event.detail.path;
                console.log("Tree select:", path);
                state.pathList = path;
            },
            treeToggle({ event }) {
                // handle tree toggle event
                const path = event.detail.path;
                console.log("Tree toggle:", path);
            },
            listSelect({event}) {
                // handle list select event
                const path = event.detail.path;
                console.log("List select:", path);
            },
            listToggle({ event }) {
                // handle list toggle event
                const path = event.detail.path;
                console.log("List toggle:", path);
            }
        }
    }
};

