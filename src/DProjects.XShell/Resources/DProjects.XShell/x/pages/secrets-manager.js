
export default {
    contract: {
        description: "Manage encrypted secrets.",
        properties: {
            mode: {type:"string", default:"manage", state:true, context:true},
            secretName: {type:"string", default:"", state:true, context:true},
            passkeyId: {type:"string", default:"", state:true, context:true}
        }
    },

    meta: {title:"Secrets manager", icon:"x-key"},

    style: `
        :scope {display:block;}
        .toolbar {display:inline-flex; align-items:center; gap:.5em; margin-bottom:1em;}
        .spacer {flex:1;}
        .hint {color:var(--x-color-gray); margin-bottom:1em;}        
    `,

    template: `
        <x-notice x-if="state.error" type="error" label="Error" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <!-- Secrets list -->
        <x-tabs x-if="state.mode == 'manage' && state.ready && !state.busy" use-hash>
       
            <x-tab label="Vault"  x-if="state.mode == 'manage' && state.ready" hash="vault">
                <div x-if="state.status != 'unlocked'">
                    <p x-text="state.status == 'uninitialized' ? 'Create a vault before managing secrets and passkeys.' : 'Unlock the vault to manage secrets and passkeys.'"></p>
                    <x-button x-attr:label="state.status == 'uninitialized' ? 'Create vault' : 'Unlock vault'" icon="x-key" command="openUnlock" x-attr:disabled="state.busy"></x-button>
                </div>
                <div x-if="state.status == 'unlocked'">
                    <p>
                        Vault unlocked
                        <span x-if="state.sessionExpiresAt">
                            (session expires in <x-countdown x-attr:value="state.sessionExpiresAt" format="{d}d {hh}h {mm}m {ss}s"></x-countdown>)
                        </span>
                    </p>
                    <div class="toolbar">
                        <x-button label="Lock" icon="x-lock" command="lock" x-attr:disabled="state.busy"></x-button>
                    </div>
                </div>
            </x-tab>

            <x-tab label="Secrets" class="secrets" x-if="state.mode == 'manage' && state.ready && state.status == 'unlocked'" hash="secrets">
                <x-form>
                    <p>
                        Here you can add, edit, and delete your secrets as needed.
                    </p>

                    <x-empty x-if="state.items.length == 0" icon="x-key" label="No secrets" message="Add a secret to your vault."></x-empty>

                    <x-listview x-if="state.items.length > 0" view="details">
                        <x-listview-head>
                            <x-listview-column label="Label"></x-listview-column>
                            <x-listview-column label="Name"></x-listview-column>
                            <x-listview-column label="Description"></x-listview-column>
                            <x-listview-column label="Revision"></x-listview-column>
                            <x-listview-column label="Created"></x-listview-column>
                            <x-listview-column label="Modified"></x-listview-column>
                            <x-listview-column label="Actions" slot="right" width="5em" style="text-align:right"></x-listview-column>
                        </x-listview-head>
                        <x-listview-body>
                            <x-listview-item x-for="item in state.items" x-attr:key="item.id" x-attr:path="item.id" x-attr:label="item.label" icon="x-key">
                                <span x-text="item.name"></span>
                                <span x-text="item.description || '—'"></span>
                                <span x-text="item.revision"></span>
                                <span x-text="item.createdDisplay"></span>
                                <span x-text="item.modifiedDisplay"></span>
                                <div class="actions" style="text-align:right">
                                    <x-button class="plain" icon="x-edit" tooltip="Edit" x-attr:data-name="item.name" x-on:click="edit" ></x-button>
                                    <x-button class="plain" icon="x-trash" tooltip="Delete" x-attr:data-name="item.name" x-on:click="remove"></x-button>
                                </div>
                            </x-listview-item>
                        </x-listview-body>
                    </x-listview>
                    <x-button slot="footer" label="Add secret" icon="x-add" command="add" x-attr:disabled="state.busy"></x-button>
                </x-form>
                
            </x-tab>

            <x-tab label="Passkeys" class="passkeys" x-if="state.mode == 'manage' && state.ready && state.status == 'unlocked'" hash="passkeys">
                <x-form>
                    <p>
                        Here you can add, edit, and delete your passkeys as needed.
                    </p>
                    <p class="hint" x-if="!state.passkeySupported">Passkeys require WebAuthn on a secure origin. Password unlocking remains available.</p>

                    <x-empty x-if="state.passkeys.length == 0" icon="x-key" label="No passkeys" message="Password recovery remains available after passkeys are added."></x-empty>

                    <x-listview x-if="state.passkeys.length > 0" view="details">
                        <x-listview-head>
                            <x-listview-column label="Passkey"></x-listview-column>
                            <x-listview-column label="Description"></x-listview-column>
                            <x-listview-column label="Created"></x-listview-column>
                            <x-listview-column label="Actions" slot="right" width="5em" style="text-align:right"></x-listview-column>
                        </x-listview-head>
                        <x-listview-body>
                            <x-listview-item x-for="passkey in state.passkeys" x-attr:key="passkey.id" x-attr:label="passkey.label" icon="x-key">
                                <span x-text="passkey.description || '—'"></span>
                                <span x-text="passkey.createdDisplay"></span>
                                <div class="actions" style="text-align:right">
                                    <x-button class="plain" icon="x-edit" tooltip="Edit" x-attr:data-id="passkey.id" x-on:click="editPasskey"></x-button>
                                    <x-button class="plain" icon="x-trash" tooltip="Remove" x-attr:data-id="passkey.id" x-on:click="removePasskey"></x-button>
                                </div>
                            </x-listview-item>
                        </x-listview-body>
                    </x-listview>

                    <x-button slot="footer" label="Add passkey" icon="x-add" command="openPasskey" x-attr:disabled="state.busy || !state.passkeySupported"></x-button>
                </x-form>   
                
            </x-tab>
        </x-tabs>

        <!-- Add / Edit dialog -->
        <x-form x-if="(state.mode == 'add' || state.mode == 'edit') && state.ready" command="save">
            <x-datafields columns="1">
                <x-datafield type="text" label="Name" required x-model="state.secretName" description="Unique identifier for the secret" autofocus></x-datafield>
                <x-datafield type="text" label="Label" x-model="state.label" description="Optional friendly display name"></x-datafield>
                <x-datafield type="text" label="Description" x-model="state.description"></x-datafield>
                <x-datafield type="select" label="Value type" x-prop:domain="state.valueTypes" x-model="state.valueType"></x-datafield>
                <x-datafield x-if="state.valueType == 'text'" type="password" label="Secret value" autocomplete="off" x-model="state.editorValue" required></x-datafield>
                <x-datafield x-if="state.valueType == 'json'" type="textarea" label="JSON value" x-model="state.editorValue" required></x-datafield>
            </x-datafields>
            <x-details label="Advanced">
                <x-datafields columns="2">
                    <x-datafield x-if="state.mode == 'edit'" type="text" label="Created" readonly x-model="state.createdDisplay"></x-datafield>
                    <x-datafield x-if="state.mode == 'edit'" type="text" label="Modified" readonly x-model="state.modifiedDisplay"></x-datafield>
                    <x-datafield x-if="state.mode == 'edit'" type="text" label="Revision" readonly x-model="state.revision"></x-datafield>
                </x-datafields>
            </x-details>
            <x-button slot="footer" class="submit" label="Save" command="save" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>

        <!-- Add passkey dialog -->
        <x-form x-if="state.mode == 'add-passkey' && state.ready" command="enrollPasskey">
            <p>Create a passkey that can unwrap this vault's data encryption key.</p>
            <x-datafields>
                <x-datafield type="text" label="Label" required autofocus x-model="state.passkeyLabel"></x-datafield>
                <x-datafield type="textarea" label="Description" x-model="state.description" description="Passkey descriptions are stored as plaintext local metadata. Do not put secrets in this field"></x-datafield>
                <x-datafield type="password" label="Master password" autocomplete="current-password" required x-model="state.password" description="The master password reauthenticates enrollment and remains the recovery method"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Add passkey" command="enrollPasskey" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>

        <!-- Edit passkey dialog -->
        <x-form x-if="state.mode == 'edit-passkey' && state.ready" command="savePasskey">
            <x-datafields>
                <x-datafield type="text" label="Label" readonly x-model="state.passkeyLabel"></x-datafield>
                <x-datafield type="textarea" label="Description" autofocus x-model="state.description" description="Passkey descriptions are stored as plaintext local metadata. Do not put secrets in this field"></x-datafield>
                <x-datafield type="text" label="Created" readonly x-model="state.createdDisplay"></x-datafield>
            </x-datafields>            
            <x-button slot="footer" class="submit" label="Save" command="savePasskey" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>
    `,

    state: {
        ready: false,
        busy: false,
        error: "",
        status: "locked",
        items: [],
        passkeys: [],
        passkeySupported: false,
        password: "",
        passkeyLabel: "",
        passkeyId: "",
        secretName: "",
        label: "",
        description: "",
        createdAt: null,
        createdDisplay: "",
        modifiedAt: null,
        modifiedDisplay: "",
        revision: null,
        originalName: "",
        originalLabel: "",
        originalDescription: "",
        originalValueType: "text",
        originalEditorValue: "",
        valueType: "text",
        editorValue: "",
        sessionExpiresAt: null,
        valueTypes: [
            {value:"text", label:"Text"},
            {value:"json", label:"JSON"}
        ]
    },

    controller({state, page, secrets, dialog, bus, events}) {
        let alive = true;
        const clear = () => {
            state.password = "";
            state.passkeyLabel = "";
            state.secretName = "";
            state.label = "";
            state.description = "";
            state.createdAt = null;
            state.createdDisplay = "";
            state.modifiedAt = null;
            state.modifiedDisplay = "";
            state.revision = null;
            state.originalName = "";
            state.originalLabel = "";
            state.originalDescription = "";
            state.originalValueType = "text";
            state.originalEditorValue = "";
            state.editorValue = "";
        };
        const message = error => error?.message || "The operation failed.";
        const formatDate = value => {
            if (!value) return "—";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
        };
        const displayInfo = item => ({...item, createdDisplay:formatDate(item.createdAt), modifiedDisplay:formatDate(item.modifiedAt)});

        return {
            captureSecret(name = state.secretName) {
                // Retain the loaded values so edits and partial saves can be distinguished.
                state.originalName = name;
                state.originalLabel = state.label;
                state.originalDescription = state.description;
                state.originalValueType = state.valueType;
                state.originalEditorValue = state.editorValue;
            },

            async load() {
                events.on(bus, "secrets:status-changed", "onStatusChanged");
                state.passkeySupported = globalThis.isSecureContext === true && typeof globalThis.navigator?.credentials?.get === "function";
                if (state.mode == "manage") return await this.refresh();
                if (state.mode == "add" || state.mode == "add-passkey") {
                    state.status = secrets.status;
                    state.ready = true;
                    return;
                }

                if (state.mode == "edit") {
                    state.busy = true;
                    try {
                        const [value, info] = await Promise.all([secrets.get(state.secretName, {interactive:false}), secrets.getInfo(state.secretName)]);
                        if (!alive) return;
                        if (value === undefined || !info) throw new Error("Secret not found.");
                        state.valueType = typeof value === "string" ? "text" : "json";
                        state.editorValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
                        state.secretName = info.name;
                        state.label = info.label;
                        state.description = info.description;
                        state.createdAt = info.createdAt;
                        state.createdDisplay = formatDate(info.createdAt);
                        state.modifiedAt = info.modifiedAt;
                        state.modifiedDisplay = formatDate(info.modifiedAt);
                        state.revision = info.revision;
                        this.captureSecret();
                        state.status = secrets.status;
                        state.ready = true;
                    } catch (error) {
                        if (alive) state.error = message(error);
                    } finally {
                        if (alive) state.busy = false;
                    }
                }

                if (state.mode == "edit-passkey") {
                    state.busy = true;
                    try {
                        const passkey = (await secrets.listPasskeys()).find(item => item.id === state.passkeyId);
                        if (!alive) return;
                        if (!passkey) throw new Error("Passkey not found.");
                        state.passkeyLabel = passkey.label;
                        state.description = passkey.description;
                        state.createdAt = passkey.createdAt;
                        state.createdDisplay = formatDate(passkey.createdAt);
                        state.status = secrets.status;
                        state.ready = true;
                    } catch (error) {
                        if (alive) state.error = message(error);
                    } finally {
                        if (alive) state.busy = false;
                    }
                }
            },

            unload() {
                alive = false;
                clear();
                state.items = [];
                state.passkeys = [];
            },

            async onStatusChanged() {
                if (!alive) return;
                state.status = secrets.status;
                state.sessionExpiresAt = secrets.sessionExpiresAt;
                if (state.status != "unlocked") {
                    clear();
                    state.items = [];
                    if (state.mode != "manage") return await page.close(null);
                }
                if (state.mode == "manage") await this.refresh();
            },

            async refresh() {
                state.busy = true;
                try {
                    await secrets.ready();
                    if (!alive) return;
                    state.status = secrets.status;
                    state.sessionExpiresAt = secrets.sessionExpiresAt;
                    state.passkeys = state.status == "uninitialized" ? [] : (await secrets.listPasskeys()).map(displayInfo);
                    state.items = state.status == "unlocked" ? (await secrets.list()).map(displayInfo) : [];
                    state.error = "";
                } catch (error) {
                    if (!alive) return;
                    state.items = [];
                    state.passkeys = [];
                    state.status = secrets.status;
                    state.sessionExpiresAt = secrets.sessionExpiresAt;
                    state.error = message(error);
                } finally {
                    if (alive) {
                        state.ready = true;
                        state.busy = false;
                        page.invalidate();
                    }
                }
            },

            async openUnlock() {
                if (state.busy || secrets.status == "unlocked") return;
                state.error = "";
                state.busy = true;
                try {
                    const result = await dialog.open({
                        href: secrets.page,
                        context: {}
                    });
                    // Refresh after the entire initialization and optional passkey setup completes.
                    if (alive && result?.unlocked && secrets.status === "unlocked") await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async lock() {
                secrets.lock();
                clear();
                state.items = [];
                state.status = secrets.status;
                state.sessionExpiresAt = secrets.sessionExpiresAt;
                state.error = "";
            },

            async openEditor(mode, name = "") {
                if (secrets.status != "unlocked") return void (state.error = "Unlock the vault first.");
                try {
                    const result = await dialog.open({
                        href: "page:x:/pages/secrets-manager.js",
                        title: mode == "add" ? "Add secret" : "Edit secret",
                        context: {mode, secretName:name}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                }
            },

            async add() {
                await this.openEditor("add");
            },

            async openPasskey() {
                if (secrets.status != "unlocked") return void (state.error = "Unlock the vault first.");
                try {
                    const result = await dialog.open({
                        href: "page:x:/pages/secrets-manager.js",
                        title: "Add passkey",
                        context: {mode:"add-passkey"}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                }
            },

            async openPasskeyEditor(id) {
                if (secrets.status != "unlocked") return void (state.error = "Unlock the vault first.");
                try {
                    const result = await dialog.open({
                        href: "page:x:/pages/secrets-manager.js",
                        title: "Edit passkey",
                        context: {mode:"edit-passkey", passkeyId:id}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                }
            },

            async edit({event}) {
                const name = event.currentTarget.dataset.name;
                if (name) await this.openEditor("edit", name);
            },

            async editPasskey({event}) {
                const id = event.currentTarget.dataset.id;
                if (id) await this.openPasskeyEditor(id);
            },

            async save() {
                if (state.busy || secrets.status != "unlocked") return;
                const name = state.secretName;
                if (!name.trim()) return void (state.error = "Secret name is required.");

                let value = state.editorValue;
                if (state.valueType == "json") {
                    try { value = JSON.parse(state.editorValue); }
                    catch { state.error = "The value must contain valid JSON."; return; }
                }

                state.error = "";
                state.busy = true;
                let changesSaved = false;
                try {
                    if (state.mode == "add") {
                        const items = await secrets.list();
                        if (items.some(item => item.name === name)) throw new Error("A secret with this name already exists.");
                        await secrets.set(name, value, {label:state.label, description:state.description});
                    } else {
                        const metadata = {};
                        if (state.label !== state.originalLabel) metadata.label = state.label;
                        if (state.description !== state.originalDescription) metadata.description = state.description;
                        const valueChanged = state.valueType !== state.originalValueType || state.editorValue !== state.originalEditorValue;
                        if (valueChanged || Object.keys(metadata).length) {
                            await secrets.set(state.originalName, value, metadata);
                            changesSaved = true;
                            this.captureSecret(state.originalName);
                        }
                        if (name !== state.originalName) await secrets.rename(state.originalName, name);
                    }
                    if (!alive) return;
                    clear();
                    await page.close({saved:true});
                } catch (error) {
                    if (alive) state.error = changesSaved && name !== state.originalName
                        ? `Secret changes were saved under '${state.originalName}', but the rename failed: ${message(error)}`
                        : message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async remove({event}) {
                if (state.busy || secrets.status != "unlocked") return;
                const name = event.currentTarget.dataset.name;
                if (!name) return;

                try {
                    const result = await dialog.confirm({title:"Delete secret", message:"Delete secret '" + name + "'?"});
                    if (result != "yes" || !alive) return;
                    state.busy = true;
                    state.error = "";
                    await secrets.delete(name);
                    if (alive) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async enrollPasskey() {
                if (state.busy || secrets.status != "unlocked") return;
                const label = state.passkeyLabel.trim();
                if (!label) return void (state.error = "Passkey label is required.");
                if (!state.password) return void (state.error = "Enter the master password.");

                state.error = "";
                state.busy = true;
                try {
                    await secrets.addPasskey({label, password:state.password, description:state.description});
                    if (!alive) return;
                    clear();
                    await page.close({saved:true});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async savePasskey() {
                if (state.busy || secrets.status != "unlocked") return;
                state.error = "";
                state.busy = true;
                try {
                    await secrets.updatePasskey(state.passkeyId, {description:state.description});
                    if (!alive) return;
                    clear();
                    await page.close({saved:true});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async removePasskey({event}) {
                if (state.busy || secrets.status != "unlocked") return;
                const id = event.currentTarget.dataset.id;
                const passkey = state.passkeys.find(item => item.id === id);
                if (!passkey) return;

                try {
                    const result = await dialog.confirm({
                        title:"Remove passkey",
                        message:"Remove passkey '" + passkey.label + "' from this local vault?"
                    });
                    if (result != "yes" || !alive) return;
                    state.busy = true;
                    state.error = "";
                    await secrets.removePasskey(id);
                    if (alive) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async cancel() {
                clear();
                await page.close(null);
            }
        };
    }
};
