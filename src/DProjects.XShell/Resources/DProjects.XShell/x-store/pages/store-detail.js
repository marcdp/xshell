export default {
    contract: {
        description: "Adds or edits one Store document through its collection JSON Schema.",
        properties: {
            src: {type: "string", default: "mem:", state: true, query: true},
            collection: {type: "string", default: "", state: true, query: true},
            id: {type: "string", default: "", state: true, query: true}
        }
    },
    meta: {
        title: "Store Document",
        description: "Schema-generated JSON document editor."
    },
    template: `
        <x-notice x-if="state.loading" type="working" label="Loading document"></x-notice>
        <x-notice x-if="state.error" type="error" x-prop:message="state.error"></x-notice>
        <x-form x-if="!state.loading && state.schema">
            <x-schema ref="editor" x-prop:schema="state.schema" x-prop:value="state.document" x-on:change="changed"></x-schema>
            <x-button slot="footer" class="submit" label="Save" x-on:click="save" x-attr:disabled="state.saving"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" x-on:click="cancel" x-attr:disabled="state.saving"></x-button>
        </x-form>
    `,
    state: {
        src: "mem:",
        collection: "",
        id: "",
        store: null,
        schema: null,
        document: {},
        loading: true,
        saving: false,
        error: ""
    },
    controller({state, stores, page}) {
        let alive = true;

        return {
            async load() {
                // Resolve the same cached Store identity used by the Explorer.
                try {
                    state.store = await stores.open(state.src);
                    const definition = state.store.schema.collections[state.collection];
                    if (!definition) throw new Error(`Unknown Store collection '${state.collection}'`);
                    state.schema = definition.schema;
                    if (state.id) {
                        const document = await state.store.get(state.collection, state.id);
                        if (!document) throw new Error(`Document '${state.id}' was not found in collection '${state.collection}'`);
                        state.document = document;
                    } else {
                        state.document = {id: crypto.randomUUID()};
                    }
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    if (alive) state.loading = false;
                }
            },
            unload() {
                // Prevent late async updates after closing the stack Page.
                alive = false;
            },
            changed({event}) {
                // Keep a detached JSON copy and omit optional fields that x-schema represents as undefined.
                state.document = JSON.parse(JSON.stringify(event.detail.newValue));
                state.error = "";
            },
            async save() {
                // Run editor validation before the Store repeats authoritative provider-side validation.
                if (state.saving) return;
                const editor = page.host?.querySelector('x-schema[ref="editor"]');
                const errors = editor?.validate(true) || [{label: "Editor", message: "Schema editor is not available."}];
                if (errors.length) {
                    state.error = errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ");
                    return;
                }
                state.saving = true;
                state.error = "";
                try {
                    const document = JSON.parse(JSON.stringify(state.document));
                    const saved = state.id
                        ? await state.store.save(state.collection, document)
                        : await state.store.add(state.collection, document);
                    if (alive) page.close({saved: true, id: saved.id});
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    if (alive) state.saving = false;
                }
            },
            cancel() {
                // Close without a mutation result so the Explorer need not refresh.
                page.close(null);
            }
        };
    }
};
