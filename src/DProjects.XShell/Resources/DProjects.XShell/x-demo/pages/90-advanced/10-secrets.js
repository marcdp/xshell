
const SAMPLE_ID = "x-demo:secrets-example";
const SAMPLE_VALUE = {
    demo: "xshell-secrets-example",
    message: "Hello from XShell"
};

const isSampleValue = value =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.demo === SAMPLE_VALUE.demo;

export default {
    meta: {
        title: "Secrets",
        description: "Demonstrates secure storage, retrieval, deletion, and vault lifecycle events."
    },

    template: `
        <p>The <code>secrets</code> service provides encrypted, browser-local storage.
        Applications access it through dependency injection without managing encryption keys directly.</p>

        <p>This demo uses only the identifier <code>x-demo:secrets-example</code>
        and a harmless example value. It does not require you to enter real credentials.</p>

        <h2>Vault status</h2>
        <p>The vault must be initialized and unlocked before storing or deleting secrets.</p>

        <x-datafields columns="2">
            <x-datafield label="Status">{{ state.status }}</x-datafield>
            <x-datafield label="Session expires">{{ state.sessionExpiresAt }}</x-datafield>
        </x-datafields>

        <p>
            <x-button label="Refresh status" command="refresh"></x-button>
            <x-button label="Open Secrets Manager" command="openManager"></x-button>
            <x-button label="Lock vault" command="lock"></x-button>
        </p>

        <x-notice x-if="state.error"
            type="error"
            label="Secrets error"
            x-attr:message="state.error">
        </x-notice>

        <x-notice x-if="state.message"
            type="success"
            x-attr:message="state.message">
        </x-notice>

        <p x-if="state.status == 'uninitialized'">
            The vault has not been initialized. Open Secrets Manager to create it.
        </p>
        <p x-if="state.status == 'locked'">
            The vault is locked. Open Secrets Manager to unlock it.
        </p>

        <pre x-pre><code>controller({secrets}) {
    return {
        async load() {
            const status = await secrets.ready();
        }
    };
}</code></pre>

        <h2>Store a secret</h2>
        <p>Use <code>secrets.set()</code> to store a JSON-compatible value.
        The service encrypts the value before persisting it.</p>

        <p><x-button label="Save example secret" command="saveExample"></x-button></p>

        <pre x-pre><code>await secrets.set("x-demo:secrets-example", {
    demo: "xshell-secrets-example",
    message: "Hello from XShell"
}, {
    description: "XShell Cookbook example"
});</code></pre>

        <h2>Retrieve a secret</h2>
        <p>Use <code>secrets.get()</code> to decrypt a stored value.
        This example disables automatic authentication prompts so locked-vault
        errors are handled explicitly.</p>

        <p><x-button label="Read example secret" command="readExample"></x-button></p>

        <p>Last read value:</p>
        <pre>{{ state.value }}</pre>

        <pre x-pre><code>const value = await secrets.get(
    "x-demo:secrets-example",
    {interactive: false}
);</code></pre>

        <h2>List secrets</h2>
        <p><code>secrets.list()</code> returns identifiers and metadata,
        not decrypted values. This demo displays only its own example identifier.</p>

        <p><x-button label="Refresh example metadata" command="refresh"></x-button></p>

        <x-datafields columns="2">
            <x-datafield label="Identifier">{{ state.sampleId }}</x-datafield>
            <x-datafield label="Exists">{{ state.exists ? "Yes" : "No" }}</x-datafield>
            <x-datafield label="Description">{{ state.description }}</x-datafield>
            <x-datafield label="Created">{{ state.createdAt }}</x-datafield>
        </x-datafields>

        <pre x-pre><code>const entries = await secrets.list();

const example = entries.find(
    item => item.id === "x-demo:secrets-example"
);</code></pre>

        <h2>Delete a secret</h2>
        <p><code>secrets.delete()</code> permanently removes the selected
        secret. This button only targets the Cookbook example identifier.</p>

        <p><x-button label="Delete example secret" command="deleteExample"></x-button></p>

        <pre x-pre><code>await secrets.delete("x-demo:secrets-example");</code></pre>

        <h2>Vault lifecycle events</h2>
        <p>The Secrets service publishes <code>secrets:status-changed</code>
        on the XShell Event Bus whenever the vault lifecycle or remembered-session
        expiration changes.</p>

        <x-datafields columns="2">
            <x-datafield label="Events received">{{ state.eventCount }}</x-datafield>
            <x-datafield label="Last event status">{{ state.lastEvent }}</x-datafield>
        </x-datafields>

        <pre x-pre><code>events.on(bus, "secrets:status-changed", event => {
    console.log(event.detail.status);
});</code></pre>

        <h2>Passkeys and authentication</h2>
        <p>The Secrets service supports master-password authentication,
        WebAuthn PRF passkeys, and optional remembered sessions.
        Use Secrets Manager to initialize the vault, unlock it, and manage passkeys.</p>

        <p>This demo intentionally does not collect passwords or perform
        passkey enrollment. Locking the vault also affects other Pages using
        the same service.</p>

        <h2>Service integration</h2>
        <p>The Secrets contract describes the public methods and properties.
        Its implementation-specific <code>optionsSchema</code> describes
        configuration such as remembered-session policy and the authentication Page.</p>

        <p>Return to <x-anchor href="01-services.js">Services</x-anchor>
        for dependency injection, or continue with
        <x-anchor href="07-tasks.js">Tasks</x-anchor> and
        <x-anchor href="08-commands.js">Commands</x-anchor>.</p>
    `,

    state: {
        status: "Loading",
        sessionExpiresAt: "None",
        busy: false,
        sampleId: SAMPLE_ID,
        exists: false,
        description: "",
        createdAt: "",
        value: "Not read",
        message: "",
        error: "",
        eventCount: 0,
        lastEvent: "None"
    },

    controller({secrets, bus, events, navigation, page, state}) {
        let alive = true;

        const syncStatus = () => {
            if (!alive) return;

            state.status = secrets.status;
            state.sessionExpiresAt = secrets.sessionExpiresAt || "None";

            if (secrets.status !== "unlocked") {
                state.exists = false;
                state.description = "";
                state.createdAt = "";
                state.value = "Not available while locked";
            }
        };

        const refreshExample = async () => {
            if (secrets.status !== "unlocked") return;

            const entries = await secrets.list();
            if (!alive || secrets.status !== "unlocked") return;

            const example = entries.find(item => item.id === SAMPLE_ID);

            state.exists = !!example;
            state.description = example?.description || "";
            state.createdAt = example?.createdAt || "";
        };

        const execute = async (operation, successMessage) => {
            if (!alive || state.busy) return;

            syncStatus();
            state.error = "";
            state.message = "";

            if (secrets.status !== "unlocked") {
                state.error = "Unlock the vault in Secrets Manager first.";
                return;
            }

            state.busy = true;

            try {
                await operation();

                if (!alive) return;

                await refreshExample();

                if (alive) {
                    state.message = successMessage;
                }
            } catch (error) {
                if (alive) {
                    state.error = error?.message || String(error);
                    syncStatus();
                }
            } finally {
                if (alive) {
                    state.busy = false;
                    page.invalidate?.();
                }
            }
        };

        return {
            async load() {
                events.on(bus, "secrets:status-changed", "onStatusChanged");
                await this.refresh();
            },

            unload() {
                alive = false;
                state.value = "";
                state.message = "";
                state.error = "";
            },

            async refresh() {
                if (!alive || state.busy) return;

                state.busy = true;
                state.error = "";

                try {
                    await secrets.ready();
                    if (!alive) return;

                    syncStatus();
                    await refreshExample();
                } catch (error) {
                    if (alive) {
                        state.error = error?.message || String(error);
                    }
                } finally {
                    if (alive) {
                        state.busy = false;
                        page.invalidate?.();
                    }
                }
            },

            onStatusChanged() {
                if (!alive) return;

                state.eventCount++;
                state.lastEvent = secrets.status;
                syncStatus();
                page.invalidate?.();
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
            },

            lock() {
                if (!alive) return;

                secrets.lock();
                syncStatus();
                state.message = "The shared vault has been locked.";
                state.error = "";
            },

            async saveExample() {
                await execute(async () => {
                    const existing = await secrets.get(
                        SAMPLE_ID,
                        {interactive: false}
                    );

                    if (existing !== undefined && !isSampleValue(existing)) {
                        throw new Error(
                            "The example identifier contains unrelated data. Nothing was overwritten."
                        );
                    }

                    await secrets.set(SAMPLE_ID, SAMPLE_VALUE, {
                        description: "XShell Cookbook example"
                    });

                    if (alive) state.value = "Not read";
                }, "Example secret saved.");
            },

            async readExample() {
                await execute(async () => {
                    const value = await secrets.get(
                        SAMPLE_ID,
                        {interactive: false}
                    );

                    if (!alive || secrets.status !== "unlocked") return;

                    if (value === undefined) {
                        state.value = "Secret not found";
                    } else if (isSampleValue(value)) {
                        state.value = JSON.stringify(value, null, 2);
                    } else {
                        state.value = "Unrecognized content (hidden)";
                    }
                }, "Read operation completed.");
            },

            async deleteExample() {
                await execute(async () => {
                    const existing = await secrets.get(
                        SAMPLE_ID,
                        {interactive: false}
                    );

                    if (existing !== undefined && !isSampleValue(existing)) {
                        throw new Error(
                            "The example identifier contains unrelated data. Nothing was deleted."
                        );
                    }

                    if (existing !== undefined) {
                        await secrets.delete(SAMPLE_ID);
                    }

                    if (alive) state.value = "Not read";
                }, "Example secret deleted.");
            }
        };
    }
};
