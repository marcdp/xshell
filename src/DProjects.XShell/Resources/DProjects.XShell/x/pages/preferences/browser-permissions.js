// Browser permissions that can be queried for the current origin where supported.
const PERMISSIONS = [
    {name: "geolocation", label: "Location", description: "Access your approximate or precise location."},
    {name: "notifications", label: "Notifications", description: "Display system notifications."},
    {name: "camera", label: "Camera", description: "Access your camera."},
    {name: "microphone", label: "Microphone", description: "Access your microphone."},
    {name: "clipboard-read", label: "Read clipboard", description: "Read text from your clipboard."},
    {name: "clipboard-write", label: "Write clipboard", description: "Write text to your clipboard."},
    {name: "persistent-storage", label: "Persistent storage", description: "Protect local site data from automatic eviction."}
];

export default {
    contract: {
        description: "View and manage supported browser permissions for the current origin.",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {title: "Browser permissions", icon: "x-lock"},
    style: `
        .action  { text-align:center;}
    `,
    template: `
        <p>View permissions for this site. Request access where supported, or use your browser's site settings to allow, block, or revoke access.</p>

        <div class="toolbar" slot="header-actions">
            <x-button class="light round" tooltip="Refresh" icon="x-refresh" x-on:click="refresh" x-attr:disabled="state.loading || state.busyName != ''"></x-button>
        </div>

        <x-notice x-if="!state.secure" type="warning" label="Secure connection required" message="Most browser permission APIs require HTTPS or a trusted local origin."></x-notice>
        <x-notice x-if="state.loading" type="working" label="Checking permissions"></x-notice>

        <x-datafield label="Current origin" type="text" x-attr:value="state.origin" disabled></x-datafield>
        <x-datafield label="Secure connection" type="checkbox" x-attr:value="state.secure" disabled></x-datafield>
        <x-datafield label="Permissions" class="no-padding">
            <x-listview view="details" x-on:activate="request">
                <x-listview-head>
                    <x-listview-column label="Permission" width="12em"></x-listview-column>
                    <x-listview-column label="Description"></x-listview-column>
                    <x-listview-column label="Status" width="7em"></x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="permission in state.permissions" x-attr:key="permission.name" x-attr:label="permission.label" x-attr:data-permission="permission.name">
                        <span x-text="permission.description"></span>
                        <span>
                            <x-icon x-if="permission.status == 'denied'" icon="x-close"></x-icon>
                            <x-icon x-if="permission.status == 'granted'" icon="x-check"></x-icon>
                            <x-icon x-if="permission.status == 'prompt'" icon="x-empty"></x-icon>
                            {{permission.statusLabel}}
                        </span>
                    </x-listview-item>
                </x-listview-body>
            </x-listview>
        </x-datafield>
    `,
    state: {
        origin: null,
        secure: true,
        permissions: [],
        loading: false,
        busyName: ""
    },
    controller({state, events, dialog}) {
        let alive = true;
        let refreshRevision = 0;

        return {
            async load() {
                // Observe focus changes so permissions edited in browser settings can be refreshed.
                state.secure = globalThis.isSecureContext !== false;
                state.origin = globalThis.location?.origin ?? null;
                if (typeof globalThis.window?.addEventListener === "function") events.on(window, "focus", "refresh");
                if (typeof globalThis.document?.addEventListener === "function") events.on(document, "visibilitychange", "onVisibilityChange");
                await this.refresh();
            },
            onVisibilityChange() {
                if (alive && document.visibilityState === "visible") this.refresh();
            },
            isAvailable(name) {
                // Feature availability is separate from browser support for permissions.query().
                const browser = globalThis.navigator;
                switch (name) {
                    case "geolocation": return typeof browser?.geolocation?.getCurrentPosition === "function";
                    case "notifications": return typeof globalThis.Notification?.requestPermission === "function";
                    case "camera":
                    case "microphone": return typeof browser?.mediaDevices?.getUserMedia === "function";
                    case "clipboard-read": return typeof browser?.clipboard?.readText === "function";
                    case "clipboard-write": return typeof browser?.clipboard?.writeText === "function";
                    case "persistent-storage": return typeof browser?.storage?.persist === "function";
                    default: return false;
                }
            },
            async inspect(permission) {
                // Query without requesting access; fall back to feature-specific status where possible.
                const browser = globalThis.navigator;
                const available = this.isAvailable(permission.name);
                let status = available ? "unknown" : "unavailable";
                if (available && typeof browser?.permissions?.query === "function") {
                    try {
                        const result = await browser.permissions.query({name: permission.name});
                        status = result.state;
                    } catch {
                        // Browsers need not support every permission descriptor.
                    }
                }
                if (available && permission.name === "notifications" && status === "unknown") {
                    const value = globalThis.Notification.permission;
                    status = value === "default" ? "prompt" : value;
                }
                if (available && permission.name === "persistent-storage" && typeof browser.storage?.persisted === "function") {
                    try {
                        if (await browser.storage.persisted()) status = "granted";
                        else if (status === "unknown") status = "not-persistent";
                    } catch {
                        // The permission query may still be available.
                    }
                }
                const labels = {
                    granted: "Allowed", prompt: "Ask", denied: "Blocked", unknown: "Unknown",
                    unavailable: "Unavailable", "not-persistent": "Not persistent"
                };
                const requestable = ["geolocation", "notifications", "camera", "microphone", "persistent-storage"].includes(permission.name);
                return {
                    ...permission,
                    status,
                    statusLabel: labels[status] ?? "Unknown",
                    canRequest: state.secure && available && requestable && status !== "granted" && status !== "denied"
                };
            },
            async refresh() {
                // Ignore stale query responses when multiple refreshes overlap or the Page unloads.
                if (!alive) return;
                const revision = ++refreshRevision;
                state.loading = true;
                try {
                    const permissions = await Promise.all(PERMISSIONS.map(permission => this.inspect(permission)));
                    if (alive && revision === refreshRevision) state.permissions = permissions;
                } catch (error) {
                    if (alive && revision === refreshRevision) {
                        dialog.message({
                            type: "error",
                            message: error?.message || "Unable to read browser permissions."
                        });
                    }
                } finally {
                    if (alive && revision === refreshRevision) state.loading = false;
                }
            },
            async request({event}) {
                // Invoke the feature API directly from the user's click, so browsers can show a native prompt.
                debugger
                const name = event.target.dataset.permission;
                const permission = state.permissions.find(item => item.name === name);
                if (!alive || !permission?.canRequest || state.loading || state.busyName) return;
                state.busyName = name;
                const browser = globalThis.navigator;
                try {
                    switch (name) {
                        case "geolocation":
                            await new Promise((resolve, reject) => browser.geolocation.getCurrentPosition(
                                () => resolve(), reject, {enableHighAccuracy: false, maximumAge: 0, timeout: 10000}
                            ));
                            break;
                        case "notifications": {
                            const result = await globalThis.Notification.requestPermission();
                            if (result !== "granted" && alive) {
                                dialog.message({
                                    message: "Notifications were not granted. Use your browser's site settings to change this."
                                });
                            }
                            break;
                        }
                        case "camera":
                        case "microphone": {
                            // Release the device immediately; never keep, render, or save the media stream.
                            const constraints = name === "camera" ? {video: true} : {audio: true};
                            const stream = await browser.mediaDevices.getUserMedia(constraints);
                            stream.getTracks().forEach(track => track.stop());
                            break;
                        }
                        case "persistent-storage": {
                            const persisted = await browser.storage.persist();
                            if (!persisted && alive) {
                                dialog.message({
                                    type:"warning",
                                    message: "The browser did not enable persistent storage for this origin."
                                });
                            }
                            break;
                        }
                    }
                } catch (error) {
                    if (alive) {
                        dialog.message({
                            type: "error",
                            message: error?.message || "The browser did not grant this permission."
                        });
                    }
                } finally {
                    if (alive) {
                        state.busyName = "";
                        await this.refresh();
                    }
                }
            },
            unload() {
                // XShell's Services scope disposes the Events helper after Page unload.
                alive = false;
                refreshRevision++;
            }
        };
    }
};