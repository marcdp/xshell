export default {
    contract: {
        description: "Add a passkey or edit its description.",
        properties: {
            passkeyId: {type:"string", default:"", state:true, context:true}
        }
    },

    meta: {
        title:"Passkey",
        icon:"x-key"
    },

    template: `
        <x-notice x-if="state.error" type="error" label="Passkey editor" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <x-form x-if="state.ready" command="save">
            <x-datafields columns="1">
                <x-datafield type="text" label="Label" x-model="state.label" x-attr:readonly="state.editing" x-attr:required="!state.editing" x-attr:autofocus="!state.editing" x-attr:disabled="state.busy"></x-datafield>
                <x-datafield type="textarea" label="Description" x-model="state.description" x-attr:autofocus="state.editing" x-attr:disabled="state.busy"
                    description="Passkey descriptions are stored as plaintext local metadata. Do not put secrets in this field."></x-datafield>
                <x-datafield x-if="state.editing" type="text" label="Created" readonly x-prop:value="state.createdDisplay"></x-datafield>
                <x-datafield x-if="!state.editing" type="password" label="Master password" autocomplete="current-password" required x-model="state.password"
                    description="The master password reauthenticates enrollment and remains the recovery method." x-attr:disabled="state.busy"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" x-attr:label="state.editing ? 'Save' : 'Add passkey'" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>
        <x-button x-if="!state.ready" class="cancel" label="Cancel" command="cancel"></x-button>
    `,

    state: {
        ready: false,
        busy: false,
        editing: false,
        error: "",
        label: "",
        description: "",
        createdDisplay: "",
        password: ""
    },

    controller({state, page, secrets, bus, events}) {
        let alive = true;
        let closing = false;
        let locked = false;

        return {
            async load() {
                // Require an unlocked vault and use the context to select a registration.
                const id = state.passkeyId;
                state.editing = Boolean(id);
                events.on(bus, "secrets:status-changed", event => this.onStatusChanged(event));
                try {
                    await secrets.ready();
                    if (!alive || closing || locked) return;
                    if (secrets.status !== "unlocked") return this.onStatusChanged();

                    if (state.editing) {
                        // Display registration metadata while leaving the label read-only.
                        const passkey = (await secrets.listPasskeys()).find(item => item.id === id);
                        if (!this.canAccessVault()) return;
                        if (!passkey) throw new Error("Passkey not found.");
                        state.label = passkey.label;
                        state.description = passkey.description;
                        state.createdDisplay = new Date(passkey.createdAt).toLocaleString();
                    } else {
                        const credentials = globalThis.navigator?.credentials;
                        if (globalThis.isSecureContext !== true || typeof credentials?.get !== "function" ||
                            typeof credentials?.create !== "function") {
                            throw new Error("Adding a passkey requires a secure origin and WebAuthn credential support.");
                        }
                    }
                    state.ready = true;
                } catch (error) {
                    if (alive && !closing && !locked) state.error = error?.message || "Unable to load the passkey editor.";
                }
            },

            canAccessVault() {
                return alive && !closing && !locked && secrets.status === "unlocked";
            },

            clear() {
                // Discard credentials and form fields when the editor is invalidated or closed.
                Object.assign(state, {ready:false, busy:false, error:"", passkeyId:"", label:"", description:"", createdDisplay:"", password:""});
            },

            unload() {
                // Clear editor state when the layout disposes the Page.
                alive = false;
                this.clear();
            },

            onStatusChanged(event) {
                // Prevent late enrollment or metadata results from completing a locked editor.
                if (!alive || closing || locked || (event?.detail?.status ?? secrets.status) === "unlocked") return;
                locked = true;
                this.clear();
                state.error = "The vault is locked. Unlock it and reopen the editor.";
            },

            async save() {
                // Validate enrollment fields and prevent simultaneous submissions.
                if (!this.canAccessVault() || !state.ready || state.busy) return;
                const {description, passkeyId} = state;
                const label = state.label.trim();
                if (!state.editing) {
                    if (!label) return void (state.error = "Passkey label is required.");
                    if (!state.password) return void (state.error = "Enter the master password.");
                }

                state.error = "";
                state.busy = true;
                try {
                    if (state.editing) {
                        await secrets.updatePasskey(passkeyId, {description});
                    } else {
                        // Hand off the reauthentication password and remove it from reactive state immediately.
                        const options = {label, password:state.password, description};
                        state.password = "";
                        await secrets.addPasskey(options);
                    }
                    if (this.canAccessVault()) await this.close({saved:true});
                } catch (error) {
                    if (this.canAccessVault()) {
                        state.error = error?.message || (state.editing ? "Unable to update the passkey." : "Passkey enrollment failed.");
                    }
                } finally {
                    if (alive && !closing && !locked) state.busy = false;
                }
            },

            async close(result) {
                // Return only the dialog outcome after clearing form state.
                if (!alive || closing) return;
                closing = true;
                this.clear();
                await page.close(result);
            },

            async cancel() {
                await this.close(null);
            }
        };
    }
};
