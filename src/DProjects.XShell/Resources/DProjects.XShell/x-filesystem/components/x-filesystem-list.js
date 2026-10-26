
// contract
export const contract = {
    description: "Filesystem list component",
    events: {},
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
        <x-listview view="details" views="list, details, tiles, icons" x-on:select="select" x-on:activate="activate">
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
        entries: []
    },
    controller({ state, events, host }) {
        return {
            async load(args) {
                // load
                events.on(state, ["change:path", "change:filesystem"], "refresh");
                events.on(state, ["change:search_name"], "filter");
                if (state.path) this.refresh(state.path);
            },
            async refresh(path) {
                if (state.filesystem && state.path) {
                    console.log("Refreshing path:", state.path);
                    
                    const entries = [];
                    // iterate over filesystem entries and collect them into an array
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
                }
            },
            async select({event}){
                // select
                console.log("Selected: " +  event.detail.path)
                host.dispatchEvent(new CustomEvent("select", {bubbles: true, detail: {path: event.detail.path}}));
            },
            async activate({event}){
                // activate
                console.log("Activated: " +  event.detail.path)
                host.dispatchEvent(new CustomEvent("activate", {bubbles: true, detail: {path: event.detail.path}}));
            }

        }
    }
};

