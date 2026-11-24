
// component
export default {
    contract: {
        description: "Displays the global menu.",
        tags: ["navigation", "menus", "pages"],
        events: {},
        properties: {
            expanded: {type: "boolean", default:false, attribute: true, state: true, description: "Indicates whether the global menu is expanded."}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Place the effective global menu in a window sidebar.",
                template: `<x-app-menu></x-app-menu>`
            }
        ]
    },
    style: `
        :host {display:flex; flex-direction: row;}
        :host > div {
            display:flex; background:var(--x-layout-main-drawer-background); border-right: var(--x-layout-main-border); flex-direction: column;
            height:100%;
            box-sizing: border-box;
            padding:.5em;
        }
        div span {flex: 1;}
    `,
    template: `
        <div>
            <div x-if="state.menuGlobal" >

                <x-menuitem x-recursive="(menuitem,index,indexAbsolute,indent) in state.menuGlobal"
                    x-key="id,href,path,command,order"
                    x-attr:embedded="menuitem.embedded"
                    x-attr:label="menuitem.label"
                    x-attr:href="menuitem.href"
                    x-attr:command="menuitem.command"
                    x-attr:icon="menuitem.icon"
                    x-attr:selected="(indent==0 && menuitem.href == state.selected)"
                    x-attr:class="(indent==0 && !state.expanded ? 'icon ' : '') + menuitem.class"
                    x-attr:tooltip="menuitem.tooltip"
                    x-attr:open="menuitem.open"
                    x-attr:outlet="menuitem.outlet"
                    >
                </x-menuitem>

            </div>
            <span></span>
            <div x-if="state.menuShortcuts">

                <x-dropdown class="tasks right up" collapse-on-click x-show="state.tasksRunning + state.tasksFinished > 0">
                    <x-button class="round light" icon="x-tasks" tooltip="Background tasks"
                        x-attr:badge="state.tasksFinished > 0 ? state.tasksFinished : (state.tasksRunning > 0 ? state.tasksRunning : '')"
                        x-attr:badge-class="state.tasksFinished == 0 ? 'plain' : ''"
                    ></x-button>
                    <x-page slot="dropdown" src="/pages/tasks.js" loading="lazy"></x-page>
                </x-dropdown>

                <div>
                    <x-menuitem x-recursive="(menuitem,index,indexAbsolute,indent) in state.menuShortcuts"
                        x-key="id,href,path,command,order"
                        x-attr:embedded="menuitem.embedded"
                        x-attr:label="menuitem.label"
                        x-attr:href="menuitem.href"
                        x-attr:command="menuitem.command"
                        x-attr:icon="menuitem.icon"
                        x-attr:selected="(indent==0 && menuitem.href == state.selected)"
                        x-attr:class="(indent==0 && !state.expanded ? 'icon ' : '') + menuitem.class"
                        x-attr:tooltip="menuitem.tooltip"
                        x-attr:open="menuitem.open"
                        x-attr:outlet="menuitem.outlet"
                        >
                    </x-menuitem>
                </div>
            </div>
        </div>


    `,
    state: {
        expanded: false,
        selected: "",
        menuGlobal: null,
        menuShortcuts: null,
        tasksRunning:    0,
        tasksFinished:   0,
        tasksButtonVisible: false
    },
    controller({ events, bus, state, tasks, areas, host }) {
        return {
            load() {
                // load
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:navigation:end", "refreshSelected");
                events.on(bus, ["xshell:tasks:added", "xshell:tasks:updated", "xshell:tasks:removed"], "refreshTasks");
                this.refresh();
                this.refreshSelected();
                this.refreshTasks();
            },

            refresh() {
                //refresh
                state.menuGlobal = areas.getMenu("global").items;
                state.menuShortcuts = areas.getMenu("shortcuts").items;
            },
            refreshSelected() {
                // Resolve the Area home to its canonical href.
                const area = areas.getCurrentArea();
                let href = area?.home ? areas.resolvePath(area.home)?.href || area.home : "";
                // Remove the Area prefix to match global menu hrefs.
                if (area?.prefix && href.startsWith(area.prefix + "/")) {
                    href = href.substring(area.prefix.length);
                }
                state.selected = href;
            },
            refreshTasks() {
                // refresh the count of pending and running background tasks
                const tasksRunningBefore = state.tasksRunning;
                const allTasks = tasks.list();
                state.tasksButtonVisible = allTasks.filter(task => task.background).length > 0;
                state.tasksRunning = allTasks.filter(task => task.background && (task.status === "pending" || task.status === "running")).length;
                state.tasksFinished = allTasks.filter(task => task.background && task.status === "finished").length;
                if (tasksRunningBefore == 0 && state.tasksRunning > 0) {
                    const dropdown = host.shadowRoot.querySelector("x-dropdown.tasks");
                    dropdown.expand();
                }
            },
        }
    }
};
