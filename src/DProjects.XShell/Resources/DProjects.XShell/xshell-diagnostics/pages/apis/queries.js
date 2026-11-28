export default {
    contract: {
        description: "Lists discovered Queries and links to their invocation forms."
    },
    meta: {
        title: "Queries",
        description: "Discover and run Queries contributed by the framework and application modules."
    },
    style: `
        .tags { display: flex; flex-wrap: wrap; gap: .25em; align-items: center; }
    `,
    template: `
        <x-listview view="details" x-on:activate="invokeQuery">
            <x-listview-head>
                <x-listview-column width="14em"><x-datafield type="search" x-model="state.id" placeholder="Query"></x-datafield></x-listview-column>
                <x-listview-column width="12em"><x-datafield type="search" x-model="state.label" placeholder="Label"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.description" placeholder="Description"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.moduleId" placeholder="Module"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.category" placeholder="Category"></x-datafield></x-listview-column>
                <x-listview-column width="15em"><x-datafield type="search" x-model="state.tags" placeholder="Tags"></x-datafield></x-listview-column>
                <x-listview-column label="Size" width="6em" style="text-align:right"></x-listview-column>
                <x-listview-column label="File" width="3em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
                <x-listview-item x-for="item in state.items" x-prop:value="item.id" x-attr:label="item.id" x-attr:icon="item.icon || 'x-search'">
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
        <x-empty x-if="state.items.length == 0" label="No matching Queries"></x-empty>
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
    controller({state, queries, events, page, navigation}) {
        const fields = ["id", "label", "description", "moduleId", "category"];
        return {
            load() {
                // Refresh the listing after changes to any column filter.
                this.refresh();
                for (const name of [...fields, "tags"]) events.on(state, `change:${name}`, "refresh");
            },
            invokeQuery({ event }) {
                // Open the existing invocation Page for the activated Query row.
                const id = event.detail?.value;
                if (typeof id !== "string" || !id.trim() || !queries.getInfo(id)) return;
                return navigation.navigate({
                    href: "page:x:/pages/invoke.js",
                    page,
                    open: "stack",
                    params: { type: "query", id, method: "query" }
                });
            },
            refresh() {
                // Build stacked invocation links from the metadata-only discovery results.
                const matches = (value, filter) => !filter || String(value ?? "").toLowerCase().includes(filter.toLowerCase());
                state.items = queries.list()
                    .filter(item => fields.every(name => matches(item[name], state[name])) &&
                        (!state.tags || item.tags.some(tag => matches(tag, state.tags))))
                    .map(item => ({
                        ...item,
                        href: `page:x:/pages/invoke.js?${new URLSearchParams({type: "query", id: item.id, method: "query"})}`
                    }));
            }
        };
    }
};
