export default {
    contract: {
        description: "Add or edit one named Filesystem definition.",
        properties: {
            filesystemName: {type: "string", default: "", state: true, query: true}
        }
    },

    meta: {
        title: "Filesystem",
        description: "Configure a named filesystem connection.",
        icon: "x-folder",
        classes: ["size-narrow"]
    },

    template: `
        <x-notice x-if="state.error" type="error" label="Filesystem" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <x-form x-if="state.ready" ref="form">
            <x-datafields columns="1">
                <x-datafield type="text" label="Name" required x-model="state.name"
                    description="Stable identifier used by the application."
                    x-attr:readonly="state.editing" x-attr:disabled="state.busy"></x-datafield>

                <x-datafield type="text" label="Label" x-model="state.label"
                    description="Optional human-readable name."
                    x-attr:disabled="state.busy"></x-datafield>

                <x-datafield type="select" label="Provider" required x-model="state.provider"
                    x-prop:domain="state.providerDomain" x-on:change="providerChanged"
                    x-attr:disabled="state.busy || state.editing"></x-datafield>
            </x-datafields>

            <x-schema x-if="state.optionsSchema" ref="optionsEditor" x-prop:schema="state.optionsSchema"
                x-prop:value="state.options" x-on:change="optionsChanged"
                x-attr:disabled="state.busy"></x-schema>

            <x-schema x-if="state.credentialsSchema" ref="credentialsEditor" x-prop:schema="state.credentialsSchema"
                x-prop:value="state.credentials" x-on:change="credentialsChanged"
                x-attr:disabled="state.busy"></x-schema>

            <x-button slot="footer" class="submit" label="Save" x-on:click="save" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" x-on:click="cancel" x-attr:disabled="state.busy"></x-button>
        </x-form>
    `,

    state: {
        filesystemName: "",
        ready: false,
        busy: false,
        editing: false,
        error: "",
        providers: [],
        providerDomain: [],
        name: "",
        label: "",
        provider: "",
        optionsSchema: null,
        credentialsSchema: null,
        options: {},
        credentials: {}
    },

    controller({state, filesystems, page}) {
        let alive = true;

        return {
            async load() {
                // Load provider metadata and initialize either an existing or new definition.
                try {
                    const providers = await filesystems.listProviders();
                    if (!alive) return;

                    state.providers = providers;
                    state.providerDomain = providers.map(provider => ({value: provider.id, label: provider.label}));
                    if (!providers.length) throw new Error("No filesystem providers are configured.");

                    if (state.filesystemName) {
                        const definition = await filesystems.getDefinition(state.filesystemName);
                        if (!alive) return;
                        if (!definition) throw new Error(`Filesystem definition not found: ${state.filesystemName}`);

                        state.editing = true;
                        state.name = definition.name;
                        state.label = definition.label;
                        this.selectProvider(definition.provider, definition.options, definition.credentials);
                    } else {
                        // Prefer Memory for a new definition when available.
                        const provider = providers.find(value => value.id === "mem") ?? providers[0];
                        this.selectProvider(provider.id);
                    }

                    state.ready = true;
                } catch (error) {
                    if (alive) state.error = error?.message || "Unable to load the filesystem editor.";
                }
            },

            unload() {
                // Discard potentially sensitive credentials when the editor closes.
                alive = false;
                state.credentials = {};
                state.options = {};
            },

            selectProvider(providerId, options = {}, credentials = null) {
                // Apply provider schemas and merge authored values over its configured defaults.
                const provider = state.providers.find(value => value.id === providerId);
                if (!provider) throw new Error(`Filesystem provider not found: ${providerId}`);

                state.provider = provider.id;
                state.optionsSchema = structuredClone(provider.optionsSchema);
                state.credentialsSchema = provider.credentialsSchema ? structuredClone(provider.credentialsSchema) : null;
                state.options = {...structuredClone(provider.defaults ?? {}), ...structuredClone(options ?? {})};
                state.credentials = credentials && typeof credentials === "object" ? structuredClone(credentials) : {};
            },

            providerChanged() {
                // A new definition may switch provider; reset configuration to that provider's defaults.
                if (!state.ready || state.editing) return;
                try {
                    state.error = "";
                    this.selectProvider(state.provider);
                } catch (error) {
                    state.error = error?.message || "Unable to select the filesystem provider.";
                }
            },

            optionsChanged({event}) {
                // Keep a detached JSON representation and omit undefined optional fields.
                state.options = JSON.parse(JSON.stringify(event.detail.newValue));
                state.error = "";
            },

            credentialsChanged({event}) {
                // Keep sensitive form state detached from the generated editor.
                state.credentials = JSON.parse(JSON.stringify(event.detail.newValue));
                state.error = "";
            },

            schemaErrors(ref, label) {
                // Ask the generated schema editor for authoritative field validation.
                const editor = page.host?.querySelector(`x-schema[ref="${ref}"]`);
                if (!editor) return [{label, message: `${label} editor is not available.`}];
                return editor.validate(true).map(error => ({...error, label:error.label || label}));
            },

            async save() {
                // Validate basic identity and both generated schemas before calling the Service.
                if (state.busy) return;

                if (state.editing && !state.filesystemName) return void (state.error = "Filesystem registration identity is missing.");
                const name = state.editing ? state.filesystemName : state.name.trim();
                if (!name) return void (state.error = "Name is required.");
                if (!state.provider) return void (state.error = "Provider is required.");

                const errors = this.schemaErrors("optionsEditor", "Options");
                if (state.credentialsSchema) errors.push(...this.schemaErrors("credentialsEditor", "Credentials"));
                if (errors.length) {
                    state.error = errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ");
                    return;
                }

                state.busy = true;
                state.error = "";
                try {
                    const definition = {
                        name,
                        label: state.label.trim() || name,
                        provider: state.provider,
                        options: JSON.parse(JSON.stringify(state.options))
                    };
                    const credentials = state.credentialsSchema
                        ? JSON.parse(JSON.stringify(state.credentials))
                        : undefined;

                    await filesystems.saveDefinition(definition, credentials);
                    if (alive) {
                        state.credentials = {};
                        await page.close();
                    }
                } catch (error) {
                    if (alive) state.error = error?.message || "Unable to save the filesystem.";
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async cancel() {
                // Clear sensitive state before closing without saving.
                state.credentials = {};
                await page.close();
            }
        };
    }
};
