
export default {
    contract: {
        description: "Interactive Service Inspector.",
        properties: {},
        methods: {},
        events: {}
    },
    meta: {
        title: "Service Inspector",
        description: "Interactive Service Inspector."
    },
    style: `
        .toolbar {
            display: flex;
            align-items: center;
            gap: .75em;
            flex-wrap: wrap;
        }
        .error {
            color: #b42318;
            white-space: pre-wrap;
        }
        pre {
            padding: .75em;
            background: var(--x-color-background-alt);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            overflow: auto;
            max-height: 20em;
        }
        .history {
            max-height: 25em;
            overflow-y: auto;
            display: grid;
            gap: .5em;
        }
    `,
    template: `
        <div>
            <!-- Service -->
            <x-datafields label="Service">
                <x-toolbar>
                    <strong>{{ state.serviceId }}</strong>
                    <span class="muted">{{ state.status }}</span>
                </x-toolbar>

                <x-notice x-if="state.error" type="error"
                    x-prop:message="state.error">
                </x-notice>

                <div x-if="state.contractId">
                    <p>
                        <b>{{ state.contractLabel }}:</b>
                        {{ state.description }}
                    </p>
                    <p class="muted">Contract: {{ state.contractId }}</p>
                </div>
            </x-datafields>

            <x-tabs x-if="state.contractId">
                <!-- Properties -->
                <x-tab label="Properties">
                    <p x-if="state.properties.length == 0">
                        No properties declared.
                    </p>

                    <x-accordion x-else>
                        <x-accordion-panel
                            x-for="item in state.properties" x-key="name"
                            class="card"
                            x-attr:label="item.name"
                            x-attr:description="item.description + ' (' + item.type + (item.readonly ? ', read-only' : '') + ')'">

                            <x-button label="Read" icon="x-refresh"
                                x-attr:data-name="item.name"
                                x-attr:disabled="!state.resolved"
                                x-on:click="readProperty">
                            </x-button>

                            <x-object x-if="item.read" x-prop:value="item.value" expanded></x-object>
                        </x-accordion-panel>
                    </x-accordion>
                </x-tab>

                <!-- Methods -->
                <x-tab label="Methods">
                    <p x-if="state.methods.length == 0">
                        No methods declared.
                    </p>

                    <x-accordion x-else>
                        <x-accordion-panel
                            x-for="method in state.methods" x-key="key"
                            class="card"
                            x-attr:data-name="method.name"
                            x-attr:label="method.label"
                            x-attr:description="method.description"
                            x-on:toggle="openMethod">

                            <x-page x-if="method.opened" x-attr:src="method.src" loading="lazy"></x-page>

                        </x-accordion-panel>
                    </x-accordion>
                </x-tab>

                <!-- Events -->
                <x-tab label="Events">
                    <p x-if="state.serviceEvents.length == 0">
                        No events declared.
                    </p>

                    <x-accordion x-else>
                        <x-accordion-panel
                            x-for="item in state.serviceEvents" x-key="name"
                            class="card"
                            x-attr:label="item.name"
                            x-attr:description="item.description">

                            <div>Payload: {{ item.detail }}</div>
                        </x-accordion-panel>
                    </x-accordion>

                    <div class="toolbar" x-if="state.serviceEvents.length > 0">
                        <x-button x-if="!state.monitoring"
                            label="Start monitoring" icon="x-play"
                            x-on:click="startMonitoring">
                        </x-button>

                        <x-button x-if="state.monitoring"
                            label="Stop monitoring" icon="x-stop"
                            x-on:click="stopMonitoring">
                        </x-button>

                        <x-button label="Clear" icon="x-close"
                            x-on:click="clearEvents">
                        </x-button>
                    </div>

                    <div class="history">
                        <x-card x-for="item in state.history" x-key="id">
                            <div class="row">
                                <strong>{{ item.name }}</strong>
                                <span class="muted">{{ item.time }}</span>
                            </div>
                            <x-object x-prop:value="item.detail" expanded></x-object>
                        </x-card>
                    </div>

                    <p class="muted" x-if="state.monitoring">
                        Monitoring active. Events received from this moment onward will be recorded.
                    </p>
                </x-tab>
            </x-tabs>
        </div>
    `,
    state: {
        serviceId: "",
        status: "",
        error: "",
        resolved: false,
        contractId: "",
        contractLabel: "",
        description: "",
        properties: [],
        methods: [],
        serviceEvents: [],
        monitoring: false,
        history: []
    },
    controller({ state, services, contracts, resolver, bus, page }) {
        let instance = null, contract = null, listeners = [], sequence = 0;
        const invokePath = resolver.resolve("page:x:/pages/invoke.js")?.path;

        function stopListeners() {
            for (const { name, listener } of listeners) bus.removeEventListener(name, listener);
            listeners = [];
            state.monitoring = false;
        }

        function descriptorType(descriptor) {
            return descriptor?.type || contract?.types?.[descriptor?.ref]?.type || "any";
        }

        return {
            load() {
                // Look up only the service named by the Page URL.
                const { service } = page.query;
                if (!service?.trim()) {
                    state.error = "Missing 'service' query parameter.";
                    return;
                }
                state.serviceId = service;
                const info = services.getServiceInfo(service);
                if (!info) {
                    state.error = `Service '${service}' not found.`;
                    return;
                }

                // Resolve the service and keep its contract available for inspection if resolution fails.
                try {
                    instance = services.resolve(service);
                    if (!instance) throw new Error("Service has no live instance.");
                    state.resolved = true;
                } catch (error) {
                    state.error = error?.message || String(error);
                }
                state.status = services.getServiceInfo(service)?.state ?? info.state;
                this.loadContract(info.contractId);
            },

            loadContract(contractId) {
                // Describe the declared API without reading properties or invoking methods.
                if (!contractId) {
                    state.error ||= "This service has no registered contract.";
                    return;
                }

                contract = contracts.getContractById(contractId);
                if (!contract) {
                    state.error ||= `Contract '${contractId}' not found.`;
                    return;
                }

                state.contractId = contractId;
                state.contractLabel = contract.label || contractId;
                state.description = contract.description || "";

                state.properties = Object.entries(contract.properties || {}).map(([name, item]) => ({
                    name,
                    type: descriptorType(item),
                    readonly: item.readonly === true,
                    description: item.description || "",
                    read: false,
                    value: ""
                }));

                state.methods = Object.entries(contract.methods || {}).map(([name, method]) => ({
                    key: `${state.serviceId}:${name}`,
                    name,
                    label: `${name}(${(method.parameters || []).map(p => p.name).join(", ")})`,
                    description: method.description || "",
                    opened: false,
                    src: `${invokePath}?type=service&id=${encodeURIComponent(state.serviceId)}&method=${encodeURIComponent(name)}`
                }));

                state.serviceEvents = Object.entries(contract.events || {}).map(([name, item]) => ({
                    name,
                    description: item.description || "",
                    detail: Object.entries(item.detail || {})
                        .map(([key, value]) => `${key}: ${descriptorType(value)}`)
                        .join(", ") || "none"
                }));
            },

            openMethod({ event }) {
                // Load each invocation form when its panel is first expanded.
                const panel = event.currentTarget;
                if (!panel.expanded) return;
                const method = state.methods.find(item => item.name === panel.dataset.name);
                if (method && !method.opened) {
                    state.methods = state.methods.map(item => item.name === method.name ? { ...item, opened: true } : item);
                }
            },

            readProperty({ event }) {
                const name = event.currentTarget.dataset.name;
                if (!instance || !Object.hasOwn(contract?.properties || {}, name)) return;

                let value;
                try {
                    value = instance[name];
                } catch (error) {
                    value = `Error: ${error.message}`;
                }

                state.properties = state.properties.map(item =>
                    item.name === name ? { ...item, read: true, value } : item
                );
            },

            startMonitoring() {
                if (state.monitoring || !contract) return;

                for (const name of Object.keys(contract.events || {})) {
                    const listener = event => {
                        state.history = [{
                            id: ++sequence,
                            name: event.type,
                            time: new Date(event.ts || Date.now()).toLocaleTimeString(),
                            detail: event.detail
                        }, ...state.history].slice(0, 40);
                    };
                    bus.addEventListener(name, listener);
                    listeners.push({ name, listener });
                }

                state.monitoring = listeners.length > 0;
            },

            stopMonitoring() {
                stopListeners();
            },

            clearEvents() {
                state.history = [];
            },

            unmount() {
                stopListeners();
            },

            unload() {
                stopListeners();
                instance = null;
                contract = null;
            }
        };
    }
};
