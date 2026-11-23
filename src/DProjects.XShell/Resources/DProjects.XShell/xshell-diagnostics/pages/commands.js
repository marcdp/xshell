// page
export default {
    contract: {
        description: "Commands diagnostics page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Commands"
    },
    style: `
        .tags { display: flex; flex-wrap: wrap; gap: .25em; align-items: center; }
    `,
    template: `
        <p>Shows Commands discovered from the effective framework and module file inventories without loading their implementations.</p>
        <x-listview view="details" x-on:activate="invokeCommand">
            <x-listview-head>
                <x-listview-column width="14em"><x-datafield type="search" x-model="state.id" placeholder="Command"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.category" placeholder="Category"></x-datafield></x-listview-column>
                <x-listview-column width="15em"><x-datafield type="search" x-model="state.tags" placeholder="Tags"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="6em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
                <x-listview-item x-for="item in state.items" x-prop:value="item.id" x-attr:label="item.id" x-attr:icon="item.icon || 'x-play'">
                    <div>{{ item.label }}</div>
                    <x-truncate x-attr:text="item.description"></x-truncate>
                    <div>{{ item.moduleId }}</div>
                    <div>{{ item.category }}</div>
                    <div class="tags">
                        <x-chip x-for="tag in item.tags" x-attr:label="tag"></x-chip>
                    </div>
                    <x-file-size x-prop:value="item.size" style="text-align:right"></x-file-size>
                    <x-anchor style="text-align:right" x-attr:href="item.path" target="_blank" class="plain" tooltip="Open source file">
                        <x-icon icon="x-open-in-new"></x-icon>
                    </x-anchor>
                </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        id: "",
        label: "",
        moduleId: "",
        category: "",
        tags: "",
        description: "",
        items: []
    },
    controller({ state, commands, events, navigation, page }) {
        return {
            load() {
                // Refresh when any diagnostic filter changes.
                this.refresh();
                for (const name of ["id", "label", "moduleId", "category", "tags", "description"]) events.on(state, `change:${name}`, "refresh");
            },
            refresh() {
                // Filter the service-owned discovery snapshot without reading effective configuration directly.
                state.items = commands.list().filter(item =>
                    this.matches(item.id, state.id) &&
                    this.matches(item.label, state.label) &&
                    this.matches(item.moduleId, state.moduleId) &&
                    this.matches(item.category, state.category) &&
                    this.matchesTags(item.tags, state.tags) &&
                    this.matches(item.description, state.description));
            },
            invokeCommand({ event }) {
                // Open the existing invocation Page for the activated Command row.
                const id = event.detail?.value;
                if (typeof id !== "string" || !id.trim() || !commands.getInfo(id)) return;
                return navigation.navigate({
                    href: "page:x:/pages/invoke.js",
                    page,
                    open: "stack",
                    params: { type: "command", id, method: "execute" }
                });
            },
            matches(value, query) {
                // Match diagnostic filters consistently regardless of casing.
                return !query || String(value ?? "").toLowerCase().includes(query.toLowerCase());
            },
            matchesTags(tags, query) {
                // Match a partial tag identifier without combining tags into synthetic text.
                return !query || (tags || []).some(tag => tag.toLowerCase().includes(query.toLowerCase()));
            }
        };
    }
}
