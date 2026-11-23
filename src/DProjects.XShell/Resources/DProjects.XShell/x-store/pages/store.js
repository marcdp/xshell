export default {
    contract: {
        description: "Explores the collections and documents exposed by a Store resource.",
        properties: {
            src: {type: "string", default: "mem:", state: true, query: true, description: "Store provider source, such as mem:demo."}
        }
    },
    meta: {
        title: "Store Explorer",
        description: "Browse and edit schema-described JSON document collections."
    },
    style: `
        .workspace {display:flex; width:100%; min-width:0; min-height:24rem; margin-top:.5em;}
        .collections {flex:0 0 22%; min-width:12rem; max-width:24rem; padding:.5em; box-sizing:border-box;}
        .documents {flex:1 1 0; min-width:24rem; padding:.5em; box-sizing:border-box;}
        .heading {margin:.2em 0 .7em;}
    `,
    template: `
        <x-toolbar>
            <x-button label="Add" icon="x-add" x-on:click="add" x-attr:disabled="state.loading || !state.collection"></x-button>
            <x-button label="Refresh" icon="x-refresh" x-on:click="refresh" x-attr:disabled="state.loading"></x-button>
            <x-button label="Remove" icon="x-trash" x-on:click="remove" x-attr:disabled="state.loading || !state.selectedId"></x-button>
        </x-toolbar>

        <x-notice x-if="state.loading" type="working" label="Loading Store"></x-notice>
        <x-notice x-if="state.error" type="error" x-prop:message="state.error"></x-notice>

        <div class="workspace" x-if="state.store">
            <section class="collections">
                <h2 class="heading">Collections</h2>
                <x-listview view="list" x-on:select="selectCollection">
                    <x-listview-body>
                        <x-listview-item x-for="item in state.collections" icon="x-folder" x-attr:label="item.label"
                            x-attr:description="item.description" x-attr:path="item.name" x-prop:selected="item.name == state.collection">
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </section>

            <x-splitter></x-splitter>

            <section class="documents">
                <h2 class="heading">{{ state.collectionLabel }}</h2>
                <x-empty x-if="!state.loading && state.documents.length == 0" label="No documents"></x-empty>
                <x-listview x-else view="details" x-on:select="selectDocument" x-on:activate="activateDocument">
                    <x-listview-head>
                        <x-listview-column label="ID" width="minmax(10em, .7fr)"></x-listview-column>
                        <x-listview-column label="Values" width="minmax(14em, 1.3fr)"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.documents" icon="x-file" x-attr:label="item.id" x-attr:path="item.id">
                            <span x-text="item.summary"></span>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </section>
        </div>
    `,
    state: {
        src: "mem:",
        store: null,
        collections: [],
        collection: "",
        collectionLabel: "Documents",
        documents: [],
        selectedId: "",
        loading: false,
        error: ""
    },
    controller({state, stores, navigation, page, dialog}) {
        let alive = true;

        return {
            async load() {
                // Open the Store through the domain Service.
                await this.loadStore();
            },
            unload() {
                // Ignore asynchronous results after the Explorer leaves the Page stack.
                alive = false;
            },
            async loadStore() {
                // Discover collection metadata dynamically from the Store schema.
                state.loading = true;
                state.error = "";
                try {
                    const store = await stores.open(state.src);
                    if (!alive) return;
                    state.store = store;
                    state.collections = Object.entries(store.schema.collections).map(([name, definition]) => ({
                        name, label: definition.label || name, description: definition.description || ""
                    }));
                    if (!state.collections.some(item => item.name === state.collection)) state.collection = state.collections[0]?.name || "";
                    await this.refresh();
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    if (alive) state.loading = false;
                }
            },
            async refresh() {
                // Re-read the selected collection and derive a useful schema-driven summary for each document.
                if (!state.store || !state.collection) return;
                state.loading = true;
                state.error = "";
                try {
                    const schema = state.store.schema.collections[state.collection];
                    const names = Object.keys(schema.schema.properties || {}).filter(name => name !== "id");
                    const documents = await state.store.list(state.collection);
                    if (!alive) return;
                    state.collectionLabel = schema.label || state.collection;
                    state.documents = documents.map(document => ({
                        id: document.id,
                        summary: names.slice(0, 3).filter(name => document[name] !== undefined)
                            .map(name => `${schema.schema.properties[name].title || name}: ${String(document[name])}`).join(" · ")
                    }));
                    if (!state.documents.some(item => item.id === state.selectedId)) state.selectedId = "";
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    if (alive) state.loading = false;
                }
            },
            async selectCollection({event}) {
                // Change navigation context without hardcoding any collection names.
                state.collection = event.detail.path;
                state.selectedId = "";
                await this.refresh();
            },
            selectDocument({event}) {
                // Track the selected document for activation and removal actions.
                state.selectedId = event.detail.path;
            },
            async activateDocument({event}) {
                // Open the schema editor on the Page stack and refresh if it reports a mutation.
                await this.openDetail(event.detail.path);
            },
            async add() {
                // Open the same Detail Page without an id to select add mode.
                await this.openDetail("");
            },
            async openDetail(id) {
                // Pass only provider identity and document coordinates across the Page boundary.
                try {
                    const result = await navigation.navigate({
                        href: "page:x-store:/pages/store-detail.js", page, open: "stack",
                        params: {src: state.src, collection: state.collection, id}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                }
            },
            async remove() {
                // Confirm destructive mutation and then refresh the current collection.
                if (!state.selectedId) return;
                const id = state.selectedId;
                const result = await dialog.confirm({title: "Remove document", message: `Remove '${id}' from ${state.collectionLabel}?`});
                if (result !== "yes") return;
                try {
                    await state.store.remove(state.collection, id);
                    state.selectedId = "";
                    await this.refresh();
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                }
            }
        };
    }
};
