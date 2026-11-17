
export default {
    meta: {
        title:"Unlock vault",
        icon:"x-key"
    },

    template: `
        <x-notice x-if="!state.ready || state.busy" type="working" label="Working..."></x-notice>
        <x-notice x-if="state.error && !state.busy" type="error" x-attr:label="state.setupPasskey ? 'Passkey setup error' : 'Authentication error'" x-attr:message="state.error"></x-notice>

        <x-form x-if="state.ready && !state.setupPasskey && state.status == 'uninitialized' && !state.busy" command="initialize">
            <p>Create a master password to protect your secrets.</p>
            <x-datafields>
                <x-datafield type="password" label="Master password" autocomplete="new-password" required autofocus x-model="state.password"></x-datafield>
                <x-datafield type="password" label="Confirm master password" autocomplete="new-password" required x-model="state.confirmPassword"></x-datafield>
            </x-datafields>
            <x-details label="Advanced">
                <x-datafields columns="2">
                    <x-datafield x-if="state.passkeyEnrollmentSupported" type="checkbox" label="Set up a default passkey" x-model="state.createPasskey"></x-datafield>
                    <x-datafield type="select" label="Keep unlocked" x-prop:domain="state.rememberOptions" x-model="state.rememberMinutes" required></x-datafield>
                </x-datafields>
            </x-details>
            <x-button slot="footer" class="submit" label="Create vault" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <x-form x-if="state.ready && state.setupPasskey && !state.busy" command="enrollPasskey">
            <h2>Vault created successfully</h2>
            <p>You can add a passkey to unlock your vault more easily next time. Your master password will remain available for recovery.</p>
            <x-datafields>
                <x-datafield type="text" label="Passkey name" required autofocus x-model="state.passkeyLabel"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Create passkey" command="submit" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Not now" command="skipPasskey" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <x-form x-if="state.ready && !state.setupPasskey && state.status == 'locked' && !state.busy" command="authenticate">
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
        passkeyEnrollmentSupported: false,
        setupPasskey: false,
        passkeyLabel: null,
        passkeyDescription: null,
        createPasskey: true,
        credential: "password",
        credentials: [],
        rememberMinutes: "0",
        rememberOptions: []
    },

    controller({state, page, secrets, bus, events}) {
        let alive = true;
        let closing = false;
        let initializing = false;
        let enrollmentPassword = null;

        return {
            clearPasswords() {
                // Clear sensitive credentials from Page state.
                state.password = "";
                state.confirmPassword = "";
            },

            clearEnrollmentPassword() {
                // Release the master password retained for optional passkey enrollment.
                enrollmentPassword = null;
            },

            async closeUnlocked() {
                // Close the dialog only when the Secrets service confirms an unlocked vault.
                if (!alive || closing || initializing || state.setupPasskey || secrets.status !== "unlocked") return false;
                closing = true;
                this.clearPasswords();
                this.clearEnrollmentPassword();
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
                    {value:0, label:"Do not keep unlocked"},
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

                // Detect browser support for WebAuthn authentication and enrollment.
                state.passkeySupported = globalThis.isSecureContext === true && typeof globalThis.navigator?.credentials?.get === "function";
                state.passkeyEnrollmentSupported = state.passkeySupported && typeof globalThis.navigator?.credentials?.create === "function";

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
                    if (state.status == "uninitialized") {
                        page.label = "Create vault";
                    }
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
                this.clearEnrollmentPassword();
                state.setupPasskey = false;
                state.credentials = [];
            },

            async onStatusChanged() {
                // Handle external unlocking without interrupting an active operation.
                if (!alive || closing) return;
                if (secrets.status === "unlocked") {
                    if (!initializing && !state.setupPasskey && !state.busy) await this.closeUnlocked();
                } else {
                    // Terminate optional enrollment if the initialized vault becomes locked.
                    if (state.setupPasskey) {
                        state.setupPasskey = false;
                        this.clearEnrollmentPassword();
                        state.error = "The vault was locked before passkey setup completed. Unlock it to continue.";
                    }
                    state.status = secrets.status;
                }
            },

            async initialize() {
                // Validate the master password and selected session duration.
                if (!alive || closing || state.busy) return;
                state.error = "";
                if (!state.password) return void (state.error = "Enter a master password.");
                if (state.password !== state.confirmPassword) return void (state.error = "Passwords do not match.");

                const rememberMinutes = Number(state.rememberMinutes);
                if (!state.rememberOptions.some(item => item.value === String(rememberMinutes))) {
                    state.error = "Select a valid session duration.";
                    return;
                }

                // Preserve the password temporarily for initialization and optional passkey enrollment.
                const password = state.password;
                const createPasskey = state.createPasskey && state.passkeyEnrollmentSupported;
                enrollmentPassword = createPasskey ? password : null;
                this.clearPasswords();
                initializing = true;
                state.busy = true;
                let vaultCreated = false;

                try {
                    // Initialize the vault and establish the requested remembered session.
                    await secrets.initialize({password, rememberMinutes});
                    vaultCreated = true;
                    if (!alive || closing) return;
                    if (rememberMinutes > 0) await secrets.unlock({password, rememberMinutes});
                    if (secrets.status !== "unlocked") throw new Error("The vault was locked during initialization.");
                    state.status = secrets.status;

                    // Prepare optional passkey enrollment.
                    state.setupPasskey = createPasskey;
                    if (createPasskey) {
                        state.passkeyLabel = "This device";
                        state.passkeyDescription = "Use this device to unlock the vault.";
                    }
                } catch (error) {
                    this.clearEnrollmentPassword();
                    if (alive && !closing) {
                        state.status = secrets.status;
                        state.error = vaultCreated
                            ? `Vault created, but the requested session could not be established: ${error?.message || error}`
                            : error?.message || "Vault initialization failed.";
                    }
                } finally {
                    initializing = false;
                    if (alive) {
                        state.busy = false;

                        // Continue passkey enrollment or complete initialization.
                        if (!closing && state.setupPasskey && secrets.status === "unlocked") {
                            await this.enrollPasskey();
                        } else if (!closing && secrets.status === "unlocked") {
                            await this.closeUnlocked();
                        }
                    }
                }
            },

            async enrollPasskey() {
                // Register the passkey after explicit user confirmation.
                if (!alive || closing || state.busy || !state.setupPasskey) return;

                const label = state.passkeyLabel.trim();
                const description = state.passkeyDescription?.trim();
                if (!label) return void (state.error = "Passkey name is required.");
                if (!description) return void (state.error = "Passkey description is required.");

                state.busy = true;
                state.error = "";

                try {
                    await secrets.addPasskey({label, description, password:enrollmentPassword});
                    if (!alive || closing) return;

                    state.setupPasskey = false;
                    this.clearEnrollmentPassword();
                    await this.closeUnlocked();
                } catch (error) {
                    if (alive && !closing) state.error = error?.message || "Passkey registration failed.";
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async skipPasskey() {
                // Finish a successful initialization without registering a passkey.
                if (!alive || closing || state.busy || !state.setupPasskey) return;
                state.setupPasskey = false;
                this.clearEnrollmentPassword();
                if (secrets.status === "unlocked") await this.closeUnlocked();
                else {
                    state.status = secrets.status;
                    state.error = "The vault was locked before setup completed. Unlock it to continue.";
                }
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
                if (state.setupPasskey) return await this.skipPasskey();
                closing = true;
                this.clearPasswords();
                this.clearEnrollmentPassword();
                await page.close(null);
            }
        };
    }
};
