const preferenceKey = "xshell-diagnostics.navigation";

// The former inventory menu sorted the flat list by display label.
const legacyPageIds = [
    "app", "bus", "commands", "components", "config", "contracts", "errors", "i18n", "icons", "loader", "modules",
    "navigation", "pages", "queries", "resolver", "runtime", "schemas", "service-worker", "services", "storage", "tasks"
];

// page
export default {
    contract: {
        description: "Diagnostics console page",
        properties: {},
        methods: {},
        events: {
            toggleDock: {
                description: "Toggle the dock panel"
            }
        }
    },
    meta: {
        title: "Diagnostics console",
        description: "Provides an overview and access to various diagnostics tools and information."
    },
    template: `
        <x-toolbar slot="header-actions" role="group" aria-label="Diagnostic groups">
            <x-button x-for="group in state.groups" x-key="id" class="menuitem" command="selectGroup"
                x-attr:label="group.label" x-attr:data-group-id="group.id"
                x-class:pressed="group.id == state.selectedGroupId"></x-button>
        </x-toolbar>

        <x-tabs x-for="group in state.groups" x-key="id" x-show="group.id == state.selectedGroupId"
            x-attr:data-group-id="group.id" x-attr:selected-index="group.selectedIndex" x-on:tabchange="selectPage">
            <x-tab x-for="item in group.items" x-key="id" x-attr:label="item.label" x-attr:hash="item.id">
                <x-page x-if="state.visited[item.href]" x-attr:src="item.href"></x-page>
            </x-tab>
        </x-tabs>
    `,
    state: {
        groups: [],
        selectedGroupId: null,
        visited: {}
    },
    controller({ state, menus, page, preferences, logger }) {
        return {
            async load() {
                // Use the effective Diagnostics menu as the source of group and tab identities.
                const menu = menus.getMenu("navigation", "xshell-diagnostics");
                const groups = (menu?.items.find(item => item.id === "console")?.children ?? [])
                    .filter(group => group.id)
                    .map(group => ({ id: group.id, label: group.label, items: group.children.filter(item => item.id && item.href) }))
                    .filter(group => group.items.length);
                if (!groups.length) return;

                // Migrate a legacy index only when the replacement preference has never been saved.
                let selection = await preferences.get(preferenceKey);
                let migrated = false;
                if (selection === undefined) {
                    const index = await preferences.get("xshell-diagnostics.selectedIndex");
                    const pageId = Number.isInteger(index) ? legacyPageIds[index] : undefined;
                    const group = groups.find(group => group.items.some(item => item.id === pageId));
                    if (group) {
                        selection = { groupId: group.id, pageIds: { [group.id]: pageId } };
                        migrated = true;
                    }
                }

                // Resolve the saved identifiers against the current menu and fall back in menu order.
                state.groups = groups.map(group => ({
                    ...group, selectedIndex: group.items.findIndex(item => item.id === selection?.pageIds?.[group.id])
                }));
                const group = state.groups.find(group => group.id === selection?.groupId) ?? state.groups[0];
                this.activate(group);
                if (migrated) await this.saveSelection();
            },

            async selectGroup({ groupId }) {
                // Restore the destination group's most recent tab.
                const group = state.groups.find(group => group.id === groupId);
                if (!group || groupId === state.selectedGroupId) return;
                this.activate(group);
                await this.saveSelection();
            },

            async selectPage({ event }) {
                // Accept selection events from the active group's tabs.
                const group = state.groups.find(group => group.id === state.selectedGroupId);
                const { selectedIndex } = event.detail;
                if (!group || event.currentTarget.dataset.groupId !== group.id || !group.items[selectedIndex]) return;
                this.activate(group, selectedIndex);
                await this.saveSelection();
            },

            activate(group, selectedIndex = Math.max(0, group.selectedIndex)) {
                // Create each Page on its first visit and keep its host connected while the console is mounted.
                const { href } = group.items[selectedIndex];
                group.selectedIndex = selectedIndex;
                state.selectedGroupId = group.id;
                if (!state.visited[href]) state.visited = { ...state.visited, [href]: true };
            },

            async saveSelection() {
                // Store stable IDs in one preference so the group and its tab selections stay in sync.
                const pageIds = Object.fromEntries(state.groups.filter(group => group.selectedIndex >= 0)
                    .map(group => [group.id, group.items[group.selectedIndex].id]));
                await preferences.set(preferenceKey, { groupId: state.selectedGroupId, pageIds });
            },

            async unmount() {
                // Finalize the child Pages before the console renderer discards their hosts.
                const hosts = page.host?.querySelectorAll(":scope > x-tabs > x-tab > x-page") ?? [];
                const results = await Promise.allSettled(Array.from(hosts, host => host.removePage()));
                if (results.some(result => result.status === "rejected")) logger.error("Diagnostics: child Page cleanup failed");

                // A remount starts with only the active Page.
                const group = state.groups.find(group => group.id === state.selectedGroupId);
                state.visited = group ? { [group.items[group.selectedIndex].href]: true } : {};
            }
        };
    }
};
