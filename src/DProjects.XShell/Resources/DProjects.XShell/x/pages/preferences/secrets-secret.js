export default {
    contract: {
        description: "Add or edit an individual secret.",
        properties: {
            secretName: {type:"string", default:"", state:true, query:true}
        }
    },

    meta: {
        title:"Secret",
        icon:"x-password",
        classes: ["size-narrow"]
    },

    template: `
        <x-notice x-if="state.error" type="error" label="Secret editor" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <x-form x-if="state.ready" command="save">
            <x-datafields columns="1">
                <x-datafield type="text" label="Name" required x-model="state.name" description="Unique identifier for the secret" autofocus x-attr:disabled="state.busy"></x-datafield>
                <x-datafield type="select" label="Type" x-prop:domain="state.valueTypes" x-model="state.valueType" required x-attr:disabled="state.busy"></x-datafield>
                <x-datafield x-if="state.valueType == 'text'" type="password" label="Secret" autocomplete="off" x-model="state.editorValue" x-attr:required="!state.editing" x-attr:disabled="state.busy"></x-datafield>
                <x-datafield x-if="state.valueType == 'json'" type="textarea" label="JSON value" spellcheck="false" x-model="state.editorValue" required x-attr:disabled="state.busy"></x-datafield>
            </x-datafields>
            <x-details label="Metadata" x-if="state.editing">
                <x-datafields columns="2">
                    <x-datafield type="text" label="Label" x-model="state.label" description="Optional friendly display name" x-attr:disabled="state.busy" columns="2"></x-datafield>
                    <x-datafield type="text" label="Description" x-model="state.description" x-attr:disabled="state.busy" columns="2"></x-datafield>
                    <x-datafield type="text" label="Created" readonly x-prop:value="state.createdDisplay"></x-datafield>
                    <x-datafield type="text" label="Modified" readonly x-prop:value="state.modifiedDisplay"></x-datafield>
                    <x-datafield type="number" label="Revision" readonly x-prop:value="state.revision"></x-datafield>
                </x-datafields>
            </x-details>
            <x-button slot="footer" class="submit" label="Save" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>
        <x-button x-if="!state.ready" class="cancel" label="Cancel" command="cancel"></x-button>
    `,

    state: {
        ready: false,
        busy: false,
        editing: false,
        error: "",
        name: "",
        label: "",
        description: "",
        createdDisplay: "",
        modifiedDisplay: "",
        revision: null,
        valueType: "text",
        editorValue: "",
        valueTypes: [{value:"text", label:"Text"}, {value:"json", label:"JSON"}]
    },

    controller({state, page, secrets, bus, events}) {
        let alive = true;
        let closing = false;
        let locked = false;
        let original = null;

        return {
            async load() {
                // Read the query identity once and require an existing unlocked session.
                const name = state.secretName;
                state.editing = Boolean(name);
                events.on(bus, "secrets:status-changed", event => this.onStatusChanged(event));
                try {
                    await secrets.ready();
                    if (!alive || closing || locked) return;
                    if (secrets.status !== "unlocked") return this.onStatusChanged();

                    // Load the selected value without opening an authentication dialog.
                    if (state.editing) {
                        const [value, info] = await Promise.all([secrets.get(name, {interactive:false}), secrets.getInfo(name)]);
                        if (!this.canAccessVault()) return;
                        if (value === undefined || !info) throw new Error("Secret not found.");

                        const valueType = typeof value === "string" ? "text" : "json";
                        const editorValue = valueType === "text" ? value : JSON.stringify(value, null, 2);
                        original = {name:info.name, label:info.label, description:info.description, valueType, editorValue};
                        Object.assign(state, original, {
                            createdDisplay:new Date(info.createdAt).toLocaleString(),
                            modifiedDisplay:new Date(info.modifiedAt).toLocaleString(),
                            revision:info.revision
                        });
                    }
                    state.ready = true;
                } catch (error) {
                    if (alive && !closing && !locked) state.error = error?.message || "Unable to load the secret.";
                }
            },

            canAccessVault() {
                return alive && !closing && !locked && secrets.status === "unlocked";
            },

            clear() {
                // Remove the decrypted value, its comparison snapshot, and its metadata from the editor.
                original = null;
                Object.assign(state, {
                    ready:false, busy:false, error:"", secretName:"", name:"", label:"", description:"",
                    createdDisplay:"", modifiedDisplay:"", revision:null, valueType:"text", editorValue:""
                });
            },

            unload() {
                // Discard editor data when its stack Page unloads.
                alive = false;
                this.clear();
            },

            onStatusChanged(event) {
                // Invalidate this editor on lock, including while the Page is still loading.
                if (!alive || closing || locked || (event?.detail?.status ?? secrets.status) === "unlocked") return;
                locked = true;
                this.clear();
                state.error = "The vault is locked. Unlock it and reopen the editor.";
            },

            async save() {
                // Validate the form and snapshot the submitted fields before starting a write.
                if (!this.canAccessVault() || !state.ready || state.busy) return;
                const {name, label, description, valueType, editorValue} = state;
                if (!name.trim()) return void (state.error = "Secret name is required.");

                let value = editorValue;
                if (valueType === "json") {
                    try { value = JSON.parse(editorValue); }
                    catch { return void (state.error = "The value must contain valid JSON."); }
                } else if (!value && !(original?.valueType === "text" && original.editorValue === "")) {
                    return void (state.error = "Enter a secret value.");
                }

                state.error = "";
                state.busy = true;
                const originalName = original?.name;
                let changesSaved = false;
                try {
                    if (!originalName) {
                        // Check for a duplicate before calling the upsert API.
                        const duplicate = await secrets.getInfo(name);
                        if (!this.canAccessVault()) return;
                        if (duplicate) throw new Error("A secret with this name already exists.");
                        await secrets.set(name, value, {label, description});
                    } else {
                        // Write edited fields first, then rename the original entry if requested.
                        const metadata = {};
                        if (label !== original.label) metadata.label = label;
                        if (description !== original.description) metadata.description = description;
                        if (valueType !== original.valueType || editorValue !== original.editorValue || Object.keys(metadata).length) {
                            await secrets.set(originalName, value, metadata);
                            if (!this.canAccessVault()) return;
                            changesSaved = true;
                            original = {name:originalName, label, description, valueType, editorValue};
                        }
                        if (name !== originalName) await secrets.rename(originalName, name);
                    }
                    if (this.canAccessVault()) await this.close();
                } catch (error) {
                    if (!this.canAccessVault()) return;
                    const message = error?.message || "Unable to save the secret.";
                    state.error = changesSaved && name !== originalName
                        ? `Secret changes were saved under '${originalName}', but the rename failed: ${message}`
                        : message;
                } finally {
                    if (alive && !closing && !locked) state.busy = false;
                }
            },

            async close() {
                // Clear the editor before closing its stack entry.
                if (!alive || closing) return;
                closing = true;
                this.clear();
                await page.close();
            },

            async cancel() {
                await this.close();
            }
        };
    }
};
