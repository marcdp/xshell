
 // page
export default {
    contract: {
        description: "Runtime errors and failure diagnostics.",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "Errors",
        description: "Shows runtime errors and failure diagnostics."
    },

    style: `
        .summary {margin-bottom:1em;}
        .error-message {overflow-wrap:anywhere;}
        .error-details {max-width:100%; overflow:auto;}
    `,

    template: `
        
        <x-listview view="details" auto-scroll>
            <x-listview-head>
                <x-listview-column width="15em">
                    <x-datafield type="search" x-model="state.query_source" placeholder="Source"></x-datafield>
                </x-listview-column>
                <x-listview-column>
                    <x-datafield type="search" x-model="state.query_resource" placeholder="Resource"></x-datafield>
                </x-listview-column>
                <x-listview-column>
                    <x-datafield type="search" x-model="state.query_message" placeholder="Message"></x-datafield>
                </x-listview-column>
                <x-listview-column label="Time" width="12em"></x-listview-column>
                <x-listview-column label="Details" width="20em"></x-listview-column>
                <x-listview-column width="3em">
                    <x-button class="plain" command="clear" icon="x-clear" title="Clear errors"></x-button>
                </x-listview-column>
            </x-listview-head>
            <x-listview-body>
                <x-listview-item x-for="item in state.items" x-attr:label="item.source" icon="x-error">
                    <div x-attr:title="item.resource">{{ item.resource }}</div>
                    <div class="error-message">{{ item.message }}</div>
                    <div>{{ item.time }}</div>
                    <div class="error-details">
                        <x-object x-prop:value="item.details"></x-object>
                    </div>
                    <div></div>
                </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,

    state: {
        total: 0,
        items: [],
        query_source: "",
        query_resource: "",
        query_message: ""
    },

    controller({ state, events, bus, loader, page }) {
        const MAX_ERRORS = 500;
        let errors = [];
        let nextId = 0;

        return {
            load() {
                // Initialize filters
                events.on(state, "change:query_source", "refresh");
                events.on(state, "change:query_resource", "refresh");
                events.on(state, "change:query_message", "refresh");

                // Recover resource failures already recorded by Loader
                for (const item of loader.registry) {
                    if (item.status !== "error") continue;

                    this.add({
                        source: "Loader",
                        resource: item.resource,
                        message: "Resource loading failed",
                        time: "Earlier",
                        details: {
                            url: item.url ?? null,
                            path: item.path ?? null,
                            moduleId: item.moduleId ?? null,
                            durationMs: item.time ?? null,
                            description: item.description ?? ""
                        },
                        pendingDetails: true
                    });
                }

                // Capture future XShell error events
                events.on(bus, "*", event => {
                    if (typeof event.type !== "string" || !event.type.endsWith(":error")) return;
                    this.captureBusError(event);
                });

                // Capture uncaught JavaScript and resource-loading errors
                events.on(window, "error", event => {
                    this.captureWindowError(event);
                });

                // Capture unhandled promise rejections
                events.on(window, "unhandledrejection", event => {
                    this.captureRejection(event);
                });

                this.refresh();
            },

            add(error) {
                // Keep a bounded collection of diagnostic entries
                errors.push({
                    id: ++nextId,
                    source: error.source || "Unknown",
                    resource: error.resource || "",
                    message: error.message || "Unknown error",
                    time: error.time || new Date().toLocaleString(),
                    details: error.details || {},
                    pendingDetails: error.pendingDetails === true
                });

                if (errors.length > MAX_ERRORS) {
                    errors.splice(0, errors.length - MAX_ERRORS);
                }

                this.refresh();
            },

            captureBusError(event) {
                // Extract a safe diagnostic snapshot from the Bus event
                const detail = event.detail || {};
                const resource = typeof detail.resource === "string" ? detail.resource : "";
                const url = typeof detail.url === "string" ? detail.url : "";
                const timestamp = Number.isFinite(event.ts) ? event.ts : Date.now();

                // Enrich previously discovered Loader failures instead of duplicating them
                if (event.type === "xshell:loader:resource:error") {
                    const previous = errors.findLast(item =>
                        item.pendingDetails &&
                        item.source === "Loader" &&
                        item.resource === resource &&
                        (!item.details.url || item.details.url === url)
                    );

                    if (previous) {
                        previous.message = String(detail.message || previous.message);
                        previous.time = new Date(timestamp).toLocaleString();
                        previous.details = {
                            ...previous.details,
                            code: detail.code ?? null,
                            message: detail.message ?? null,
                            details: this.describe(detail.details),
                            durationMs: detail.time ?? previous.details.durationMs
                        };
                        previous.pendingDetails = false;
                        this.refresh();
                        return;
                    }
                }

                // Record any other Bus error event
                this.add({
                    source: event.type,
                    resource: resource || String(detail.src || ""),
                    message: String(detail.message || detail.code || event.type),
                    time: new Date(timestamp).toLocaleString(),
                    details: {
                        code: detail.code ?? null,
                        url: detail.url ?? null,
                        path: detail.path ?? null,
                        durationMs: detail.time ?? null,
                        details: this.describe(detail.details)
                    }
                });
            },

            captureWindowError(event) {
                // Distinguish JavaScript exceptions from failed resource loads
                const error = event.error;
                const target = event.target;
                const resourceError = target && target !== window;
                const resource = resourceError
                    ? target.src || target.href || target.localName || ""
                    : event.filename || "";

                this.add({
                    source: resourceError ? "Browser resource" : "JavaScript",
                    resource: String(resource),
                    message: error?.message || event.message || "Resource loading failed",
                    details: {
                        name: error?.name || null,
                        stack: error?.stack || null,
                        filename: event.filename || null,
                        line: event.lineno ?? null,
                        column: event.colno ?? null
                    }
                });
            },

            captureRejection(event) {
                // Record the rejection without changing browser error handling
                const reason = event.reason;

                this.add({
                    source: "Promise",
                    resource: "",
                    message: reason?.message || this.describe(reason),
                    details: {
                        name: reason?.name || null,
                        stack: reason?.stack || null,
                        reason: this.describe(reason)
                    }
                });
            },

            describe(value) {
                // Convert unknown error payloads into displayable text
                if (value == null) return null;
                if (typeof value === "string") return value;
                if (value instanceof Error) return `${value.name}: ${value.message}`;

                try {
                    return JSON.stringify(value);
                } catch {
                    return String(value);
                }
            },

            clear() {
                // Clear the local diagnostic history
                errors = [];
                this.refresh();
            },

            refresh() {
                // Apply the configured search filters to captured errors
                const source = state.query_source.toLowerCase();
                const resource = state.query_resource.toLowerCase();
                const message = state.query_message.toLowerCase();

                state.items = errors
                    .filter(item =>
                        (!source || item.source.toLowerCase().includes(source)) &&
                        (!resource || item.resource.toLowerCase().includes(resource)) &&
                        (!message || item.message.toLowerCase().includes(message))
                    )
                    .slice()
                    .reverse()
                    .map(item => ({
                        id: item.id,
                        source: item.source,
                        resource: item.resource,
                        message: item.message,
                        time: item.time,
                        details: item.details
                    }));

                state.total = errors.length;
                page.invalidate();
            }
        };
    }
};
