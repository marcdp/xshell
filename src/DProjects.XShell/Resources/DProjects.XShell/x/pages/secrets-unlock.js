export default {
    meta: {title:"Unlock secrets", icon:"x-key"},

    style: `
        :scope {display:block;}
        .passkey-unlock {margin-bottom:1em;}
        .hint {color:var(--x-color-gray); margin-bottom:1em;}
    `,

    template: `
        <x-notice x-if="state.error" type="error" label="Error" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy || !state.ready" type="working" label="Working"></x-notice>

        <x-form x-if="state.ready && state.status == 'uninitialized'" command="initialize">
            <p>Create a master password to protect your secrets.</p>
            <x-datafields>
                <x-datafield type="password" label="Master password" autocomplete="new-password" required autofocus x-model="state.password"></x-datafield>
                <x-datafield type="password" label="Confirm master password" autocomplete="new-password" required x-model="state.confirmPassword"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Create vault" command="initialize" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <x-form x-if="state.ready && state.status == 'locked'" command="unlock">
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
        passkeys: [],
        passkeySupported: false,
        rememberMinutes: 0,
        rememberOptions: []
    },

    controller({state, page, secrets, bus, events}) {
        let alive = true;
        let closing = false;
        const clear = () => {
            state.password = "";
            state.confirmPassword = "";
        };
        const message = error => error?.message || "Authentication failed.";
        const closeUnlocked = async () => {
            if (!alive || closing || secrets.status != "unlocked") return false;
            closing = true;
            clear();
            await page.close({unlocked:true});
            return true;
        };

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

                try {
                    await secrets.ready();
                    if (!alive || closing || await closeUnlocked()) return;
                    state.status = secrets.status;
                    state.passkeys = state.status == "uninitialized" ? [] : await secrets.listPasskeys();
                    if (!alive || closing || await closeUnlocked()) return;
                    state.status = secrets.status;
                    state.ready = true;
                    state.error = "";
                } catch (error) {
                    if (alive && !closing) {
                        state.status = secrets.status;
                        state.ready = true;
                        state.error = message(error);
                    }
                }
            },

            unload() {
                alive = false;
                clear();
                state.passkeys = [];
            },

            async onStatusChanged() {
                if (!alive || closing) return;
                state.status = secrets.status;
                if (state.status == "unlocked") await closeUnlocked();
            },

            async initialize() {
                if (state.busy || closing) return;
                state.error = "";
                if (!state.password) return void (state.error = "Enter a master password.");
                if (state.password !== state.confirmPassword) return void (state.error = "Passwords do not match.");
                state.busy = true;
                try {
                    await secrets.initialize({password:state.password});
                    await closeUnlocked();
                } catch (error) {
                    if (alive && !closing) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async unlock() {
                if (state.busy || closing) return;
                state.error = "";
                state.busy = true;
                try {
                    await secrets.unlock({password:state.password, rememberMinutes:Number(state.rememberMinutes)});
                    await closeUnlocked();
                } catch (error) {
                    if (alive && !closing) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async unlockPasskey() {
                if (state.busy || closing || !state.passkeySupported || !state.passkeys.length) return;
                state.error = "";
                state.busy = true;
                try {
                    await secrets.unlockWithPasskey({rememberMinutes:Number(state.rememberMinutes)});
                    await closeUnlocked();
                } catch (error) {
                    if (alive && !closing) state.error = message(error);
                } finally {
                    clear();
                    if (alive) state.busy = false;
                }
            },

            async cancel() {
                if (closing) return;
                closing = true;
                clear();
                await page.close(null);
            }
        };
    }
};
