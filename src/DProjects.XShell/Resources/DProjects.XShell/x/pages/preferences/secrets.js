export default {
    contract: {
        description: "Manage the vault, secrets, and passkeys."
    },

    meta: {
        title:"Secrets",
        description:"Manage your encrypted secrets vault.",
        icon:"x-key"
    },

    style: `
        .description {color: var(--x-color-text-xx-gray);}
    `,

    template: `
        <x-notice x-if="state.error" type="error" label="Error" x-attr:message="state.error"></x-notice>

        <x-toolbar slot="header-actions" x-if="state.ready">
            <x-button x-if="state.status == 'locked'" label="Unlock vault" icon="x-key" command="openUnlock" x-attr:disabled="state.busy"></x-button>
            <x-button x-if="state.status == 'unlocked'" label="Lock" icon="x-lock" command="lock" x-attr:disabled="state.busy"></x-button>
        </x-toolbar>

        <x-datafields x-if="state.ready">

            <x-datafield label="Vault" classs="no-padding">
                <p x-if="state.status == 'uninitialized'">                    
                    <x-empty icon="x-password" label="Vault not initialized" message="Create a vault in your browser before managing secrets and passkeys.">
                        <x-button x-if="state.status == 'uninitialized'" label="Create vault" icon="x-key" command="openUnlock"></x-button>
                    </x-empty>                    
                </p>
                <p x-if="state.status == 'locked'">
                    <x-icon icon="x-lock"></x-icon> 
                    Locked 
                    <span class="description">(unlock the vault to manage secrets and passkeys.)</span>
                </p>
                <p x-if="state.status == 'unlocked'">
                    <x-icon icon="x-unlock"></x-icon> 
                    Unlocked
                    <span class="description" x-if="state.sessionExpiresAt">
                        (session expires in <x-countdown x-attr:value="state.sessionExpiresAt" format="{d}d {hh}h {mm}m {ss}s"></x-countdown>)
                    </span>
                </p>
            </x-datafield>

            <x-datafield label="Secrets" class="no-padding" x-if="state.status == 'unlocked'">
                <x-listview view="details" x-on:activate="edit">
                    <x-listview-head>
                        <x-listview-column label="Label" width="10em"></x-listview-column>
                        <x-listview-column label="Name" width="10em"></x-listview-column>
                        <x-listview-column label="Description"></x-listview-column>
                        <x-listview-column label="Revision" width="5em"></x-listview-column>
                        <x-listview-column label="Created" width="7em"></x-listview-column>
                        <x-listview-column label="Modified" width="7em"></x-listview-column>
                        <x-listview-column label="Actions" width="5em" style="text-align:right">
                            <x-button class="anchor" icon="x-add" tooltip="Add secret" command="add" x-attr:disabled="state.busy"></x-button>
                        </x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.items" x-key="id" x-prop:value="item.name" x-attr:path="item.id" x-attr:label="item.label" icon="x-password">
                            <span x-text="item.name"></span>
                            <span x-text="item.description || '—'"></span>
                            <span x-text="item.revision"></span>
                            <span x-text="item.createdDisplay"></span>
                            <span x-text="item.modifiedDisplay"></span>
                            <div style="text-align:right">
                                <x-button class="anchor" icon="x-edit" tooltip="Edit" x-attr:data-name="item.name" x-on:click="edit" x-attr:disabled="state.busy"></x-button>
                                <x-button class="anchor" icon="x-close" tooltip="Delete" x-attr:data-name="item.name" x-on:click="remove" x-attr:disabled="state.busy"></x-button>
                            </div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
                <x-empty x-if="state.items.length == 0" icon="x-password" label="No secrets" message="Add a secret to your vault."></x-empty>
            </x-datafield>

            <x-datafield label="Passkeys" class="no-padding" x-if="state.status == 'unlocked'">
                <p x-if="!state.passkeySupported">Adding a passkey requires WebAuthn on a secure origin. Password unlocking remains available.</p>
                <x-listview view="details" x-on:activate="editPasskey">
                    <x-listview-head>
                        <x-listview-column label="Passkey" width="10em"></x-listview-column>
                        <x-listview-column label="Description"></x-listview-column>
                        <x-listview-column label="Created" width="7em"></x-listview-column>
                        <x-listview-column label="Actions" width="5em" style="text-align:right">
                            <x-button class="anchor" icon="x-add" tooltip="Add passkey" command="addPasskey" x-attr:disabled="state.busy || !state.passkeySupported"></x-button>
                        </x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="passkey in state.passkeys" x-key="id" x-prop:value="passkey.id" x-attr:path="passkey.id" x-attr:label="passkey.label" icon="x-key">
                            <span x-text="passkey.description || '—'"></span>
                            <span x-text="passkey.createdDisplay"></span>
                            <div style="text-align:right">
                                <x-button class="anchor" icon="x-edit" tooltip="Edit" x-attr:data-id="passkey.id" x-on:click="editPasskey" x-attr:disabled="state.busy"></x-button>
                                <x-button class="anchor" icon="x-close" tooltip="Remove" x-attr:data-id="passkey.id" x-on:click="removePasskey" x-attr:disabled="state.busy"></x-button>
                            </div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
                <x-empty x-if="state.passkeys.length == 0" icon="x-key" label="No passkeys" message="Password recovery remains available after passkeys are added."></x-empty>
            </x-datafield>
        </x-datafields>
    `,

    state: {
        ready: false,
        busy: false,
        error: "",
        status: "locked",
        sessionExpiresAt: null,
        items: [],
        passkeys: [],
        passkeySupported: false
    },

    controller({state, secrets, dialog, bus, events, navigation, page}) {
        let alive = true;
        let refreshRevision = 0;
        let lockRevision = 0;

        return {
            async load() {
                // Observe lifecycle changes and detect support for new registrations.
                events.on(bus, "secrets:status-changed", event => this.onStatusChanged(event));
                events.on(bus, "secrets:changed", "onChanged");
                const credentials = globalThis.navigator?.credentials;
                state.passkeySupported = globalThis.isSecureContext === true &&
                    typeof credentials?.get === "function" && typeof credentials?.create === "function";
                await this.refresh();
            },

            unload() {
                // Discard restricted list data and ignore pending results.
                alive = false;
                this.clearLists();
            },

            clearLists() {
                state.items = [];
                state.passkeys = [];
            },

            syncStatus() {
                // Reflect session changes before waiting for any list requests.
                state.status = secrets.status;
                state.sessionExpiresAt = secrets.sessionExpiresAt;
                if (state.status !== "unlocked") this.clearLists();
            },

            async onStatusChanged(event) {
                // A lock invalidates pending confirmations and clears the old session's lists.
                if (!alive) return;
                if ((event?.detail?.status ?? secrets.status) !== "unlocked") {
                    lockRevision++;
                    this.clearLists();
                }
                this.syncStatus();
                await this.refresh();
            },

            async onChanged() {
                // Refresh metadata after successful Secret or passkey mutations from any caller.
                if (alive && secrets.status === "unlocked") await this.refresh();
            },

            formatDate(value) {
                // Use the browser's date format for list columns.
                const date = value ? new Date(value) : null;
                return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "—";
            },

            async refresh() {
                // Only the newest refresh may publish metadata from the current session.
                if (!alive) return;
                const revision = ++refreshRevision;
                const current = () => alive && revision === refreshRevision;
                state.error = "";
                try {
                    await secrets.ready();
                    if (!current()) return;
                    this.syncStatus();
                    if (state.status !== "unlocked") return;

                    const [items, passkeys] = await Promise.all([secrets.list(), secrets.listPasskeys()]);
                    if (!current()) return;
                    this.syncStatus();
                    if (state.status !== "unlocked") return;

                    state.items = items.map(item => ({
                        ...item, createdDisplay:this.formatDate(item.createdAt), modifiedDisplay:this.formatDate(item.modifiedAt)
                    }));
                    state.passkeys = passkeys.map(passkey => ({...passkey, createdDisplay:this.formatDate(passkey.createdAt)}));
                } catch (error) {
                    if (!current()) return;
                    this.syncStatus();
                    this.clearLists();
                    state.error = error?.message || "Unable to load the vault.";
                } finally {
                    if (current()) state.ready = true;
                }
            },

            async runAction(action) {
                // Serialize management dialogs and mutations independently of status refreshes.
                if (!alive || state.busy) return;
                state.busy = true;
                state.error = "";
                try {
                    await action();
                } catch (error) {
                    if (alive) state.error = error?.message || "The operation failed.";
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async openUnlock() {
                // Delegate creation and authentication to the configured Page.
                if (secrets.status === "unlocked") return;
                await this.runAction(async () => {
                    const href = secrets.options.pageUnlock;
                    if (!href) throw new Error("Secrets unlock Page is not configured.");
                    const result = await dialog.open({href, context:{}});
                    if (alive && result?.unlocked === true && secrets.status === "unlocked") await this.refresh();
                });
            },

            async lock() {
                // Reflect the explicit lock immediately, before the Bus delivers its event.
                if (!alive || state.busy || secrets.status !== "unlocked") return;
                secrets.lock();
                state.error = "";
                await this.onStatusChanged();
            },

            async openEditor(href, params = {}) {
                // Open management editors as stacked Pages without waiting for close results.
                if (!alive || secrets.status !== "unlocked") return void (state.error = "Unlock the vault first.");
                state.error = "";
                try {
                    await navigation.navigate({href, page, open:"stack", params});
                } catch (error) {
                    if (alive) state.error = error?.message || "Unable to open the Secrets editor.";
                }
            },

            async add() {
                // Omit the query identity when creating a Secret.
                await this.openEditor("page:x:/pages/preferences/secrets-secret.js");
            },

            async edit({event}) {
                // Accept activation from the list or the edit button.
                const secretName = event.detail?.value ?? event.currentTarget.dataset.name;
                if (secretName) await this.openEditor("page:x:/pages/preferences/secrets-secret.js", {"secret-name":secretName});
            },

            async addPasskey() {
                // Enrollment requires both WebAuthn credential operations.
                if (!state.passkeySupported) return;
                await this.openEditor("page:x:/pages/preferences/secrets-passkey.js");
            },

            async editPasskey({event}) {
                // Pass the registration id through its canonical query parameter.
                const passkeyId = event.detail?.value ?? event.currentTarget.dataset.id;
                if (passkeyId) await this.openEditor("page:x:/pages/preferences/secrets-passkey.js", {"passkey-id":passkeyId});
            },

            async confirmRemoval(options, remove) {
                // Recheck the session after the confirmation dialog closes.
                if (secrets.status !== "unlocked") return;
                await this.runAction(async () => {
                    const revision = lockRevision;
                    const result = await dialog.confirm(options);
                    if (result !== "yes" || !alive || revision !== lockRevision || secrets.status !== "unlocked") return;
                    await remove();
                });
            },

            async remove({event}) {
                // Delete by the secret's current name after confirmation.
                const name = event.currentTarget.dataset.name;
                if (name) await this.confirmRemoval({title:"Delete secret", message:`Delete secret '${name}'?`}, () => secrets.delete(name));
            },

            async removePasskey({event}) {
                // Remove the selected local registration after confirmation.
                const passkey = state.passkeys.find(item => item.id === event.currentTarget.dataset.id);
                if (passkey) await this.confirmRemoval({
                    title:"Remove passkey", message:`Remove passkey '${passkey.label}' from this local vault?`
                }, () => secrets.removePasskey(passkey.id));
            }
        };
    }
};
