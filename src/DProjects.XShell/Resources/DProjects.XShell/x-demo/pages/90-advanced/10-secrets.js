
const SAMPLE_ID = "x-demo:secrets-example";
const SAMPLE_VALUE = {
    demo: "xshell-secrets-example",
    message: "Hello from XShell"
};

const isSample = value =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.demo === SAMPLE_VALUE.demo &&
    value.message === SAMPLE_VALUE.message;

export default {
    meta: {
        title: "Secrets",
        description: "Demonstrates interactive access to encrypted secrets."
    },

    template: `
        <p>The <code>secrets</code> service provides encrypted browser-local
        storage. When the vault is locked or uninitialized, calling
        <code>secrets.get()</code> automatically opens the authentication Page.</p>

        <h2>Vault status</h2>
        <x-datafields columns="2">
            <x-datafield label="Status">{{ state.status }}</x-datafield>
            <x-datafield label="Session expires">{{ state.expires }}</x-datafield>
        </x-datafields>
        <p>
            <x-button label="Unlock / Initialize" command="authenticate" x-attr:disabled="state.busy || state.status == 'unlocked'"></x-button>
            <x-button label="Lock vault" command="lock" x-attr:disabled="state.busy || state.status != 'unlocked'"></x-button>
            <x-button label="Open Secrets Manager" command="openManager"></x-button>
        </p>

        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>
        <x-notice x-if="state.error" type="error"
            x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.message" type="success"
            x-attr:message="state.message"></x-notice>

        <h2>Secret operations</h2>
        <p>All operations below request authentication automatically when
        required. This example only modifies its own sample secret.</p>

        <p>
            <x-button label="Save example" command="save"
                x-attr:disabled="state.busy"></x-button>
            <x-button label="Read example" command="read"
                x-attr:disabled="state.busy"></x-button>
            <x-button label="List example" command="list"
                x-attr:disabled="state.busy"></x-button>
            <x-button label="Delete example" command="remove"
                x-attr:disabled="state.busy"></x-button>
        </p>

        <x-datafields columns="2">
            <x-datafield label="Identifier">x-demo:secrets-example</x-datafield>
            <x-datafield label="Exists">{{ state.exists }}</x-datafield>
        </x-datafields>

        <p>Last retrieved value:</p>
        <pre>{{ state.value }}</pre>

        <h2>Automatic authentication</h2>
        <p>The first call to <code>get()</code> prompts for initialization or
        unlocking if necessary. The other operations then use the unlocked vault.</p>

        <pre x-pre><code>// Automatically authenticate when needed
const value = await secrets.get("x-demo:secrets-example");

// These methods require an unlocked vault
await secrets.set("x-demo:secrets-example", {
    message: "Hello from XShell"
});

const entries = await secrets.list();
await secrets.delete("x-demo:secrets-example");</code></pre>

        <h2>Lifecycle events</h2>
        <p>The <code>secrets:status-changed</code> Bus event reports vault
        lifecycle changes and session expiration updates.</p>

        <x-datafields columns="2">
            <x-datafield label="Events received">{{ state.eventCount }}</x-datafield>
            <x-datafield label="Last event">{{ state.lastEvent }}</x-datafield>
        </x-datafields>

        <h2>Security</h2>
        <p>This demo stores a harmless example value. It never displays
        unrelated secret values or modifies an existing record that does not
        match its sample marker.</p>

        <p>Locking the vault affects other Pages using the same Secrets service.
        Passwords, passkeys, and vault administration are handled by Secrets Manager.</p>

        <p>Return to <x-anchor href="01-services.js">Services</x-anchor>.</p>
    `,

    state: {
        status: "Loading",
        expires: "None",
        busy: false,
        error: "",
        message: "",
        exists: "Unknown",
        value: "Not read",
        eventCount: 0,
        lastEvent: "None"
    },

    controller({secrets, bus, events, navigation, page, state}) {
        let alive = true;

        const sync = () => {
            if (!alive) return;
            state.status = secrets.status;
            state.expires = secrets.sessionExpiresAt || "None";

            if (secrets.status !== "unlocked") {
                state.exists = "Unknown";
                state.value = "Not available while locked";
            }
        };

        const run = async (action, successMessage) => {
            if (!alive || state.busy) return;

            state.busy = true;
            state.error = "";
            state.message = "";

            try {
                // Automatically opens initialization/unlock dialog.
                const existing = await secrets.get(SAMPLE_ID);
                if (!alive) return;

                await action(existing);
                if (!alive) return;

                const entries = await secrets.list();
                if (!alive) return;

                state.exists = entries.some(item => item.id === SAMPLE_ID)
                    ? "Yes"
                    : "No";

                sync();
                state.message = successMessage;
            } catch (error) {
                if (!alive) return;

                sync();
                if (error?.name === "AbortError") {
                    state.message = "Authentication canceled.";
                } else {
                    state.error = error?.message || String(error);
                }
            } finally {
                if (alive) {
                    state.busy = false;
                    page.invalidate?.();
                }
            }
        };

        const checkSample = existing => {
            if (existing !== undefined && !isSample(existing)) {
                throw new Error(
                    "The example identifier contains unrelated data."
                );
            }
        };

        return {
            async load() {
                events.on(bus, "secrets:status-changed", "onStatusChanged");

                try {
                    await secrets.ready();
                    sync();
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                }
            },

            unload() {
                alive = false;
                state.value = "";
                state.error = "";
                state.message = "";
            },

            onStatusChanged() {
                if (!alive) return;
                state.eventCount++;
                state.lastEvent = secrets.status;
                sync();
            },

            async authenticate() {
                await run(async () => {}, "Vault ready.");
            },

            async save() {
                await run(async existing => {
                    checkSample(existing);

                    await secrets.set(SAMPLE_ID, SAMPLE_VALUE, {
                        description: "XShell Cookbook example"
                    });

                    if (alive) state.value = "Not read";
                }, "Example saved.");
            },

            async read() {
                await run(async existing => {
                    if (!alive) return;

                    state.value = existing === undefined
                        ? "Secret not found"
                        : isSample(existing)
                            ? JSON.stringify(existing, null, 2)
                            : "Unrelated secret content (hidden)";
                }, "Read completed.");
            },

            async list() {
                await run(async () => {}, "List refreshed.");
            },

            async remove() {
                await run(async existing => {
                    checkSample(existing);

                    if (existing !== undefined) {
                        await secrets.delete(SAMPLE_ID);
                    }

                    if (alive) state.value = "Not read";
                }, "Example deleted.");
            },

            lock() {
                if (!alive || state.busy) return;

                secrets.lock();
                sync();
                state.error = "";
                state.message = "Vault locked.";
            },

            async openManager() {
                try {
                    await navigation.navigate({
                        href: "page:x:/pages/secrets-manager.js",
                        page,
                        open: "stack"
                    });
                } catch (error) {
                    if (alive) {
                        state.error = error?.message || String(error);
                    }
                }
            }
        };
    }
};
