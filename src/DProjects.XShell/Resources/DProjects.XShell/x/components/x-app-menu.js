
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
        :host {
            display:flex;
            background:var(--x-layout-main-drawer-background);            
            flex-direction: column;
            height:100%;
            min-width:3.6em;
            box-sizing: border-box;
            padding:.5em;
        }
        .logo {display:block; text-align:center; margin-top:.25em; height:2.1em; opacity:.6}
        div {display:flex; flex-direction: column; flex:1;}
        x-menuitem.flex {flex:1; visibility:hidden;}
        x-menuitem[label='-'] {padding-left:.75em; padding-right:.75em;}
        

    `,
    template: `
        <x-icon class="logo" x-attr:icon="state.appIcon" x-attr:title="state.appLabel + ' ' + state.appVersion"></x-icon>            
        <div x-if="state.menu" >
            <x-menuitem x-recursive="(menuitem,index,indexAbsolute,indent) in state.menu"
                x-key="id,href,path,order,command"
                x-attr:label="menuitem.label"
                x-attr:href="menuitem.href"
                x-attr:command="menuitem.command"
                x-attr:icon="menuitem.icon"
                x-attr:expand-on="indent == 0 ? 'click' : 'hover'"
                x-attr:selected="(indent==0 && menuitem.href == state.selected)"
                x-attr:class="(indent==0 ? 'collapsible ' + (!state.expanded ? 'collapsed ' : '') : '') + menuitem.class"
                x-attr:tooltip="menuitem.tooltip"
                x-attr:open="menuitem.open"
                x-attr:outlet="menuitem.outlet"
                x-attr:badge="(menuitem.icon == 'x-tasks' ? ((state.tasksRunning + state.tasksFinished) || '') : menuitem.badge)"
                x-attr:badge-class="(menuitem.icon == 'x-tasks' ? (state.tasksRunning ? 'animate ' : '') + ( state.tasksFinished ? '' : 'plain ' ) : '')"
                x-on:command="command"
                x-show="(menuitem.class=='expand' && !state.expanded) || (menuitem.class=='collapse' && state.expanded) || (menuitem.class!='expand' && menuitem.class!='collapse')"
                >
            </x-menuitem>
        </div>
    `,
    state: {
        appIcon: null,
        appLabel: null,
        appVersion: null,
        expanded: false,
        selected: "",
        menu: null,
        tasksRunning:    0,
        tasksFinished:   0,
        tasksButtonVisible: false
    },
    controller({ config, events, bus, state, tasks, areas, host, preferences }) {
        return {
            async load() {
                // load
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:navigation:end", "refreshSelected");
                events.on(bus, ["xshell:tasks:added", "xshell:tasks:updated", "xshell:tasks:removed"], "refreshTasks");
                state.appIcon = config.app.icon || null;
                state.appLabel = config.app.label || null;
                state.appVersion = config.app.version || null;
                this.refresh();
                this.refreshSelected();
                this.refreshTasks();
                state.expanded = await preferences.get("x-app-menu:expanded", false);
            },

            refresh() {
                //refresh
                state.menu = areas.getMenu("global").items;
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
                    const menuitem = host.shadowRoot.querySelector(".tasks");
                    menuitem.expand();
                }
            },
            async command({ event }) {
                // command handler for menu item actions
                const command = event.detail.command;
                if (command == "expand") {
                    state.expanded = true;
                    await preferences.set("x-app-menu:expanded", state.expanded)
                } else if (command == "collapse") {
                    state.expanded = false;
                    await preferences.set("x-app-menu:expanded", state.expanded)
                }
            }
            
        }
    }
};
