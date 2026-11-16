
export default {
    contract: {
        description: "Manage encrypted secrets.",
        properties: {
            mode: {type:"string", default:"manage", state:true, context:true},
            secretId: {type:"string", default:"", state:true, context:true},
            passkeyId: {type:"string", default:"", state:true, context:true}
        }
    },

    meta: {title:"Secrets", icon:"x-key"},

    style: `
        :scope {display:block;}
        .toolbar {display:inline-flex; align-items:center; gap:.5em; margin-bottom:1em;}
        .spacer {flex:1;}
        .actions {display:flex; gap:.25em;}
        .hint {color:var(--x-color-gray); margin-bottom:1em;}
        .passkey-unlock {margin-bottom:1em;}
        .passkeys {margin-top:2em;}
        .passkeys h2 {font-size:1.1em;}
    `,

    template: `
        <x-notice x-if="state.error" type="error" label="Error" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <!-- Initialize -->
        <x-form x-if="state.mode == 'manage' && state.ready && state.status == 'uninitialized'" command="initialize">
            <p>Create a master password to protect your secrets.</p>
            <x-datafields>
                <x-datafield type="password" label="Master password" autocomplete="new-password" required x-model="state.password"></x-datafield>
                <x-datafield type="password" label="Confirm password" autocomplete="new-password" required x-model="state.confirmPassword"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Create vault" command="initialize" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <!-- Unlock -->
        <x-form x-if="state.mode == 'manage' && state.ready && state.status == 'locked'" command="unlock">
            <div class="passkey-unlock" x-if="state.passkeySupported && state.passkeys.length > 0">
                <p>Use a registered passkey to unlock this browser-local vault.</p>
                <x-button label="Unlock with passkey" icon="x-key" command="unlockPasskey" x-attr:disabled="state.busy"></x-button>
                <p class="hint">Or use the master password.</p>
            </div>
            <p x-if="!state.passkeySupported || state.passkeys.length == 0">Enter your master password to unlock the vault.</p>
            <x-datafields>
                <x-datafield type="password" label="Master password" autocomplete="current-password" required autofocus x-model="state.password"></x-datafield>
                <x-datafield x-if="state.rememberOptions.length > 0" type="select" label="Keep unlocked" x-prop:domain="state.rememberOptions" x-model="state.rememberMinutes"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Unlock with password" command="unlock" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <!-- Secrets list -->
        <div class="toolbar" slot="header-actions" x-if="state.mode == 'manage' && state.ready && state.status == 'unlocked'">
            <span class="spacer"></span>
            <x-button class="light" label="Add secret" icon="x-add" command="add" x-attr:disabled="state.busy"></x-button>
            <x-button class="light" label="Lock" icon="x-lock" command="lock" x-attr:disabled="state.busy"></x-button>
        </div>
        <div x-if="state.mode == 'manage' && state.ready && state.status == 'unlocked'">
            <p class="hint" x-if="state.sessionExpiresAt">Remembered session expires at <span x-text="state.sessionExpiresAt"></span>.</p>
            <x-listview x-if="state.items.length > 0" view="details">
                <x-listview-head>
                    <x-listview-column label="Secret"></x-listview-column>
                    <x-listview-column label="Description"></x-listview-column>
                    <x-listview-column label="Created"></x-listview-column>
                    <x-listview-column label="Actions" slot="right" width="5em" style="text-align:right"></x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="item in state.items" x-attr:key="item.id" x-attr:path="item.id" x-attr:label="item.id" icon="x-key">
                        <span x-text="item.description || '—'"></span>
                        <span x-text="item.createdDisplay"></span>
                        <div class="actions" style="text-align:right">
                            <x-button class="plain" icon="x-edit" tooltip="Edit" x-attr:data-id="item.id" x-on:click="edit" ></x-button>
                            <x-button class="plain" icon="x-trash" tooltip="Delete" x-attr:data-id="item.id" x-on:click="remove"></x-button>
                        </div>
                    </x-listview-item>                    
                </x-listview-body>
            </x-listview>
            <x-empty x-if="state.items.length == 0" icon="x-key" label="No secrets" message="Add a secret to your vault."></x-empty>

            <section class="passkeys">
                <div class="toolbar">
                    <h2>Passkeys</h2>
                    <span class="spacer"></span>
                    <x-button class="light" label="Add passkey" icon="x-add" command="openPasskey" x-attr:disabled="state.busy || !state.passkeySupported"></x-button>
                </div>
                <p class="hint" x-if="!state.passkeySupported">Passkeys require WebAuthn on a secure origin. Password unlocking remains available.</p>
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
                <x-empty x-if="state.passkeys.length == 0" icon="x-key" label="No passkeys" message="Password recovery remains available after passkeys are added."></x-empty>
            </section>
        </div>

        <!-- Add / Edit dialog -->
        <x-form x-if="(state.mode == 'add' || state.mode == 'edit') && state.ready" command="save">
            <x-datafields>
                <x-datafield type="text" label="Secret ID" required x-model="state.secretId" x-attr:readonly="state.mode == 'edit'"></x-datafield>
                <x-datafield type="textarea" label="Description" x-model="state.description"></x-datafield>
                <x-datafield type="select" label="Value type" x-prop:domain="state.valueTypes" x-model="state.valueType"></x-datafield>
                <x-datafield x-if="state.valueType == 'text'" type="password" label="Secret value" autocomplete="off" x-model="state.editorValue"></x-datafield>
                <x-datafield x-if="state.valueType == 'json'" type="textarea" label="JSON value" x-model="state.editorValue"></x-datafield>
                <x-datafield x-if="state.mode == 'edit' && state.createdAt" type="text" label="Created" readonly x-model="state.createdDisplay"></x-datafield>
            </x-datafields>
            <p class="hint">Values are encrypted before being stored.</p>
            <x-button slot="footer" class="submit" label="Save" command="save" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>

        <!-- Add passkey dialog -->
        <x-form x-if="state.mode == 'add-passkey' && state.ready" command="enrollPasskey">
            <p>Create a passkey that can unwrap this vault's data encryption key.</p>
            <x-datafields>
                <x-datafield type="text" label="Passkey label" required autofocus x-model="state.passkeyLabel"></x-datafield>
                <x-datafield type="textarea" label="Description" x-model="state.description"></x-datafield>
                <x-datafield type="password" label="Master password" autocomplete="current-password" required x-model="state.password"></x-datafield>
            </x-datafields>
            <p class="hint">The master password reauthenticates enrollment and remains the recovery method. The passkey must support WebAuthn PRF. The description is plaintext local metadata; do not put secrets in it.</p>
            <x-button slot="footer" class="submit" label="Add passkey" command="enrollPasskey" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>

        <!-- Edit passkey dialog -->
        <x-form x-if="state.mode == 'edit-passkey' && state.ready" command="savePasskey">
            <x-datafields>
                <x-datafield type="text" label="Passkey label" readonly x-model="state.passkeyLabel"></x-datafield>
                <x-datafield type="textarea" label="Description" autofocus x-model="state.description"></x-datafield>
                <x-datafield type="text" label="Created" readonly x-model="state.createdDisplay"></x-datafield>
            </x-datafields>
            <p class="hint">Passkey descriptions are stored as plaintext local metadata. Do not put secrets in this field.</p>
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
        confirmPassword: "",
        passkeyLabel: "",
        passkeyId: "",
        secretId: "",
        description: "",
        createdAt: null,
        createdDisplay: "",
        valueType: "text",
        editorValue: "",
        rememberMinutes: 0,
        rememberOptions: [],
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
            state.confirmPassword = "";
            state.passkeyLabel = "";
            state.description = "";
            state.createdAt = null;
            state.createdDisplay = "";
            state.editorValue = "";
        };
        const message = error => error?.message || "The operation failed.";
        const formatDate = value => {
            if (!value) return "Unknown";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
        };
        const displayInfo = item => ({...item, createdDisplay:formatDate(item.createdAt)});

        return {
            async load() {
                events.on(bus, "secrets:status-changed", "onStatusChanged");
                const maximum = secrets.maxRememberMinutes;
                const fallback = secrets.rememberMinutes;
                state.rememberMinutes = fallback;
                if (maximum > 0) {
                    const minutes = [...new Set([0, 15, 60, fallback].filter(value => value >= 0 && value <= maximum))].sort((left, right) => left - right);
                    state.rememberOptions = minutes.map(value => ({value, label:value === 0 ? "This session only" : `${value} minutes`}));
                }
                state.passkeySupported = globalThis.isSecureContext === true &&
                    typeof globalThis.navigator?.credentials?.get === "function";

                if (state.mode == "manage") return await this.refresh();

                if (state.mode == "add" || state.mode == "add-passkey") {
                    state.status = secrets.status;
                    state.ready = true;
                    return;
                }

                if (state.mode == "edit") {
                    state.busy = true;
                    try {
                        const [value, info] = await Promise.all([secrets.get(state.secretId), secrets.getInfo(state.secretId)]);
                        if (!alive) return;
                        if (value === undefined || !info) throw new Error("Secret not found.");
                        state.valueType = typeof value === "string" ? "text" : "json";
                        state.editorValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
                        state.description = info.description;
                        state.createdAt = info.createdAt;
                        state.createdDisplay = formatDate(info.createdAt);
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

            async initialize() {
                if (state.busy) return;
                state.error = "";
                if (!state.password) return void (state.error = "Enter a master password.");
                if (state.password !== state.confirmPassword) return void (state.error = "Passwords do not match.");

                state.busy = true;
                try {
                    await secrets.initialize({password:state.password});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async unlock() {
                if (state.busy) return;
                state.error = "";
                state.busy = true;
                try {
                    await secrets.unlock({password:state.password, rememberMinutes:Number(state.rememberMinutes)});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async unlockPasskey() {
                if (state.busy || !state.passkeySupported || !state.passkeys.length) return;
                state.error = "";
                state.busy = true;
                try {
                    await secrets.unlockWithPasskey({rememberMinutes:Number(state.rememberMinutes)});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    clear();
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

            async openEditor(mode, id = "") {
                if (secrets.status != "unlocked") return void (state.error = "Unlock the vault first.");
                try {
                    const result = await dialog.open({
                        href: "page:x:/pages/secrets.js",
                        title: mode == "add" ? "Add secret" : "Edit secret",
                        context: {mode, secretId:id}
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
                        href: "page:x:/pages/secrets.js",
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
                        href: "page:x:/pages/secrets.js",
                        title: "Edit passkey",
                        context: {mode:"edit-passkey", passkeyId:id}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = message(error);
                }
            },

            async edit({event}) {
                const id = event.currentTarget.dataset.id;
                if (id) await this.openEditor("edit", id);
            },

            async editPasskey({event}) {
                const id = event.currentTarget.dataset.id;
                if (id) await this.openPasskeyEditor(id);
            },

            async save() {
                if (state.busy || secrets.status != "unlocked") return;
                const id = state.mode == "add" ? state.secretId.trim() : state.secretId;
                if (!id) return void (state.error = "Secret ID is required.");

                let value = state.editorValue;
                if (state.valueType == "json") {
                    try { value = JSON.parse(state.editorValue); }
                    catch { state.error = "The value must contain valid JSON."; return; }
                }

                state.error = "";
                state.busy = true;
                try {
                    if (state.mode == "add") {
                        const items = await secrets.list();
                        if (items.some(item => item.id === id)) throw new Error("A secret with this ID already exists.");
                    }
                    await secrets.set(id, value, {description:state.description});
                    if (!alive) return;
                    clear();
                    await page.close({saved:true});
                } catch (error) {
                    if (alive) state.error = message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async remove({event}) {
                if (state.busy || secrets.status != "unlocked") return;
                const id = event.currentTarget.dataset.id;
                if (!id) return;

                try {
                    const result = await dialog.confirm({title:"Delete secret", message:"Delete secret '" + id + "'?"});
                    if (result != "yes" || !alive) return;
                    state.busy = true;
                    state.error = "";
                    await secrets.delete(id);
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
