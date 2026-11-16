
export default {
    meta: {title:"Unlock vault", icon:"x-key"},

    template: `
        <x-notice x-if="!state.ready || state.busy" type="working" label="Working..."></x-notice>
        <x-notice x-if="state.error && !state.busy" type="error" label="Authentication error" x-attr:message="state.error"></x-notice>

        <x-form x-if="state.ready && state.status == 'uninitialized' && !state.busy" command="initialize">
            <p>Create a master password to protect your secrets.</p>
            <x-datafields>
                <x-datafield type="password" label="Master password" autocomplete="new-password" required autofocus x-model="state.password"></x-datafield>
                <x-datafield type="password" label="Confirm master password" autocomplete="new-password" required x-model="state.confirmPassword"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Create vault" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <x-form x-if="state.ready && state.status == 'locked' && !state.busy" command="authenticate">
            <x-datafields>
                <x-datafield x-if="state.credentials.length > 1" type="radios" label="Method" x-prop:domain="state.credentials" x-model="state.credential" required></x-datafield>
                <x-datafield x-if="state.credential == 'password'" type="password" label="Master password" autocomplete="current-password" required autofocus x-model="state.password"></x-datafield>
                <x-datafield type="select" label="Keep unlocked" x-prop:domain="state.rememberOptions" x-model="state.rememberMinutes" required></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Unlock" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel" x-attr:disabled="state.busy"></x-button>
        </x-form>
    `,

    state: {
        ready: false,
        busy: false,
        error: "",
        status: "locked",
        password: "",
        confirmPassword: "",
        passkeySupported: false,
        credential: "password",
        credentials: [],
        rememberMinutes: "0",
        rememberOptions: []
    },

    controller({state, page, secrets, bus, events}) {
        let alive = true;
        let closing = false;

        return {
            clearPasswords() {
                // Clear sensitive credentials from Page state.
                state.password = "";
                state.confirmPassword = "";
            },

            async closeUnlocked() {
                // Close the dialog only when the Secrets service confirms an unlocked vault.
                if (!alive || closing || secrets.status !== "unlocked") return false;
                closing = true;
                this.clearPasswords();
                await page.close({unlocked:true});
                return true;
            },

            async execute(operation) {
                // Run one authentication operation and prevent duplicate submissions.
                if (!alive || closing || state.busy) return;
                state.busy = true;
                state.error = "";

                try {
                    await operation();
                    if (alive && !closing) await this.closeUnlocked();
                } catch (error) {
                    if (alive && !closing) state.error = error?.message || "Authentication failed.";
                } finally {
                    this.clearPasswords();
                    if (alive) {
                        state.busy = false;
                        if (!closing && secrets.status === "unlocked") await this.closeUnlocked();
                    }
                }
            },

            async load() {
                // Observe vault lifecycle changes.
                events.on(bus, "secrets:status-changed", "onStatusChanged");

                // Build session-duration choices and respect the configured service maximum.
                const maximum = secrets.maxRememberMinutes;
                const fallback = secrets.rememberMinutes;
                const durations = [
                    {value:0, label:"Do not remember"},
                    {value:15, label:"15 minutes"},
                    {value:480, label:"8 hours"},
                    {value:10080, label:"7 days"},
                    {value:43200, label:"30 days"}
                ];
                if (!durations.some(item => item.value === fallback)) durations.push({value:fallback, label:`${fallback} minutes`});
                state.rememberOptions = durations.filter(item => item.value <= maximum)
                    .sort((a, b) => a.value - b.value)
                    .map(item => ({value:String(item.value), label:item.label}));
                state.rememberMinutes = String(fallback);

                // Detect browser support for WebAuthn authentication.
                state.passkeySupported = globalThis.isSecureContext === true &&
                    typeof globalThis.navigator?.credentials?.get === "function";

                try {
                    // Restore an eligible session or discover the vault state.
                    await secrets.ready();
                    if (!alive || closing || await this.closeUnlocked()) return;
                    state.status = secrets.status;

                    // Load registered vault passkeys and append the master-password alternative.
                    const passkeys = state.status === "uninitialized" ? [] : await secrets.listPasskeys();
                    if (!alive || closing || await this.closeUnlocked()) return;

                    state.credentials = state.passkeySupported
                        ? passkeys.map(item => ({                            
                            value:`passkey:${item.id}`, 
                            label:item.label,
                            description:item.description,
                            icon:"x-passkey"
                        }))
                        : [];
                    state.credentials.push({value:"password", label:"Master password", description:"Lorem ipsum", icon:"x-password"});
                    state.credential = state.credentials[0].value;

                    state.status = secrets.status;
                    state.ready = true;
                    state.error = "";
                } catch (error) {
                    if (!alive || closing) return;
                    state.status = secrets.status;
                    state.credentials = [{value:"password", label:"Master password", description:"Lorem ipsum", "icon":"x-password"}];
                    state.credential = "password";
                    state.error = error?.message || "Unable to load the vault.";
                    state.ready = true;
                }
            },

            unload() {
                // Clear sensitive Page state without locking the vault.
                alive = false;
                this.clearPasswords();
                state.credentials = [];
            },

            async onStatusChanged() {
                // Handle external unlocking without interrupting an active operation.
                if (!alive || closing) return;
                if (secrets.status === "unlocked") {
                    if (!state.busy) await this.closeUnlocked();
                } else {
                    state.status = secrets.status;
                }
            },

            async initialize() {
                // Validate master-password confirmation before creating the vault.
                if (!alive || closing || state.busy) return;
                state.error = "";
                if (!state.password) return void (state.error = "Enter a master password.");
                if (state.password !== state.confirmPassword) return void (state.error = "Passwords do not match.");

                const password = state.password;
                await this.execute(() => secrets.initialize({password}));
            },

            async authenticate() {
                // Validate the selected credential and remembered-session duration.
                if (!alive || closing || state.busy) return;
                state.error = "";

                const rememberMinutes = Number(state.rememberMinutes);
                if (!state.rememberOptions.some(item => item.value === String(rememberMinutes))) {
                    state.error = "Select a valid session duration.";
                    return;
                }

                const credential = state.credentials.find(item => item.value === state.credential);
                if (!credential) return void (state.error = "Select a valid authentication method.");

                // Unlock with the selected master password.
                if (credential.value === "password") {
                    if (!state.password) return void (state.error = "Enter your master password.");
                    const password = state.password;
                    await this.execute(() => secrets.unlock({password, rememberMinutes}));
                    return;
                }

                // Unlock with the selected registered passkey.
                if (!state.passkeySupported || !credential.value.startsWith("passkey:")) {
                    state.error = "Passkey authentication is not available.";
                    return;
                }

                const id = credential.value.substring("passkey:".length);
                await this.execute(() => secrets.unlockWithPasskey({id, rememberMinutes}));
            },

            async cancel() {
                // Cancel authentication without changing the shared vault state.
                if (!alive || closing || state.busy) return;
                closing = true;
                this.clearPasswords();
                await page.close(null);
            }
        };
    }
};
