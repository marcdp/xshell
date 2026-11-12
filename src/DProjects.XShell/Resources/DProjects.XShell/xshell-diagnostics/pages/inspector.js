
export default {
    contract: {
        description: "Interactive Service Inspector.",
        properties: {},
        methods: {},
        events: {}
    },
    meta: {
        title: "Inspector"
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
                    <x-datafield type="select"
                        x-prop:domain="state.serviceOptions"
                        x-model="state.serviceId">
                    </x-datafield>

                    <x-button label="Resolve" icon="x-play"
                        x-attr:disabled="!state.serviceId || state.resolved"
                        x-on:click="resolveService">
                    </x-button>

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

            <!-- Properties -->
            <x-datafields x-if="state.contractId" label="Properties">
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
            </x-datafields>

            <!-- Methods -->
            <x-datafields x-if="state.contractId" label="Methods">
                <p x-if="state.methods.length == 0">
                    No methods declared.
                </p>

                <x-accordion x-else>
                    <x-accordion-panel
                        x-for="method in state.methods" x-key="key"
                        class="card"
                        x-attr:label="method.label"
                        x-attr:description="method.description">

                        <x-page x-attr:src="method.src" loading="lazy"></x-page>

                    </x-accordion-panel>
                </x-accordion>
            </x-datafields>

            <!-- Events -->
            <x-datafields x-if="state.contractId" label="Events">
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
            </x-datafields>
        </div>
    `,
    state: {
        serviceOptions: [],
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
    controller({ state, services, contracts, resolver, bus, events }) {
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
                events.on(state, "change:serviceId", "loadService");
                events.on(bus, "xshell:service:created", "refreshRegistry");
                this.refreshRegistry();
            },

            refreshRegistry() {
                const items = services.registry
                    .filter(item => item.contractId)
                    .sort((a, b) => a.id.localeCompare(b.id));

                state.serviceOptions = items.map(item => ({
                    value: item.id,
                    label: item.id
                }));

                if (!items.some(item => item.id === state.serviceId)) {
                    state.serviceId = items[0]?.id || "";
                    if (!state.serviceId) this.loadService();
                } else {
                    state.status = services.getServiceInfo(state.serviceId)?.state || "";
                }
            },

            loadService() {
                stopListeners();
                instance = null;
                contract = null;

                state.error = "";
                state.resolved = false;
                state.contractId = "";
                state.contractLabel = "";
                state.description = "";
                state.properties = [];
                state.methods = [];
                state.serviceEvents = [];
                state.history = [];
                state.status = "";

                const info = services.getServiceInfo(state.serviceId);
                if (!info) return;

                state.status = info.state;

                if (!info.contractId) {
                    state.error = "This service has no registered contract.";
                    return;
                }

                contract = contracts.getContractById(info.contractId);
                if (!contract) {
                    state.error = `Contract '${info.contractId}' not found.`;
                    return;
                }

                state.contractId = info.contractId;
                state.contractLabel = contract.label || info.contractId;
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

            resolveService() {
                if (!state.serviceId || state.resolved) return;
                try {
                    instance = services.resolve(state.serviceId);
                    if (!instance) throw new Error("Service has no live instance.");

                    state.resolved = true;
                    state.status = services.getServiceInfo(state.serviceId)?.state || "created";
                    state.error = "";
                } catch (error) {
                    state.error = error.message || String(error);
                    state.status = services.getServiceInfo(state.serviceId)?.state || "registered";
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
