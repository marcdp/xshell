
export default {
    meta: {
        title: "Services",
        description: "Demonstrates service injection, runtime discovery, contracts, and service lifetimes."
    },

    template: `
        <p>Services are named runtime capabilities shared by XShell Components, Pages, and Modules. Controllers receive services through dependency injection instead of constructing them directly.</p>

        <h2>Dependency injection</h2>
        <p>Declare the required services as properties of the controller argument. XShell resolves them by name.</p>
        <x-datafields columns="2">
            <x-datafield label="Navigation mode">{{ state.mode }}</x-datafield>
            <x-datafield label="Current Area">{{ state.area }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>controller({navigation, areas, state}) {
    return {
        load() {
            state.mode = navigation.mode;
            state.area = areas.getCurrentArea()?.label || "";
        }
    };
}</code></pre>

        <h2>Core services</h2>
        <p>XShell registers core runtime services such as <code>areas</code>, <code>navigation</code>, <code>dialog</code>, <code>loader</code>, <code>resolver</code>, <code>modules</code>, and <code>services</code>.</p>
        <p>The <code>services</code> registry allows controllers to inspect which capabilities are available.</p>
        <x-datafields columns="2">
            <x-datafield label="Registered services">{{ state.serviceCount }}</x-datafield>
            <x-datafield label="Configured services">{{ state.configuredCount }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>services.has("navigation");
services.getServiceInfo("toast");
services.registry;</code></pre>

        <h2>Service registry</h2>
        <p>The registry exposes a read-only snapshot of registered services, including their lifecycle state and contract information.</p>
        <x-button label="Refresh registry" command="refresh"></x-button>
        <ul>
            <li x-for="item in state.items" x-key="id">
                <strong>{{ item.id }}</strong> — {{ item.state }}
                <span x-if="item.contractId"> (contract: {{ item.contractId }})</span>
            </li>
        </ul>
        <pre x-pre><code>const items = services.registry;

for (const item of items) {
    // item.id, item.state, item.contractId
}</code></pre>

        <h2>Checking and resolving services</h2>
        <p>Use <code>services.has()</code> to check whether a service is registered. Use <code>services.resolve()</code> to obtain its instance.</p>
        <x-datafields columns="2">
            <x-datafield label="Navigation registered">{{ state.hasNavigation }}</x-datafield>
            <x-datafield label="Dialog registered">{{ state.hasDialog }}</x-datafield>
            <x-datafield label="Temp registered">{{ state.hasTemp }}</x-datafield>
            <x-datafield label="Unknown service registered">{{ state.hasUnknown }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>if (services.has("navigation")) {
    const navigation = services.resolve("navigation");
}</code></pre>
        <p>Checking availability does not construct a configured service. Resolving a configured service constructs its singleton on first use.</p>

        <h2>Service configuration</h2>
        <p>Configured services have a stable public contract and an implementation class selected through <code>xshell.services</code>.</p>
        <pre x-pre><code>"xshell": {
    "services": {
        "toast": {
            "contract": "toast",
            "implementation": "/services/toast-default.js"
        }
    }
}</code></pre>
        <p>XShell discovers the contract, loads the implementation class during initialization, and creates its instance when first resolved.</p>

        <h2>Service contracts</h2>
        <p>A contract describes the public methods and properties expected from a service. XShell validates their presence when constructing a configured service instance.</p>
        <pre x-pre><code>{
    "label": "Example Service",
    "methods": {
        "getValue": {
            "description": "Returns a value.",
            "returns": {"type": "string"}
        }
    }
}</code></pre>
        <p>Contracts define the expected public interface. They do not perform full runtime validation of method arguments, return values, or property types.</p>

        <h2>Service lifetime</h2>
        <p>The service registry is finalized during application startup. Configured implementations are loaded during initialization, but their instances are generally constructed lazily.</p>
        <p>Once initialized, the registry cannot be extended through <code>services.register()</code>. Configured services are shared singleton instances, not new objects for each Page.</p>

        <h2>Services versus resource dependencies</h2>
        <p>Controller injection provides runtime services. A Page's <code>dependencies</code> declaration instead loads specific resources through the Resolver and Loader.</p>
        <pre x-pre><code>dependencies: {
    icon: "icon:x-file"
},

controller({navigation, dependencies}) {
    // navigation: injected service
    // dependencies.icon: loaded resource
}</code></pre>
        <p>For a practical example of the event service, continue with <x-anchor href="02-bus.js">Event Bus</x-anchor>.</p>
    `,

    state: {
        mode: "",
        area: "",
        serviceCount: 0,
        configuredCount: 0,
        items: [],
        hasNavigation: false,
        hasDialog: false,
        hasTemp: false,
        hasUnknown: false
    },

    controller({navigation, areas, services, state}) {
        return {
            load() {
                state.mode = navigation.mode;
                state.area = areas.getCurrentArea()?.label || "";
                this.refresh();
            },
            refresh() {
                const items = services.registry;
                state.serviceCount = items.length;
                state.configuredCount = items.filter(item => item.contractId !== null).length;
                state.items = items.map(item => ({
                    id:item.id,
                    state:item.state,
                    contractId:item.contractId
                }));
                state.hasNavigation = services.has("navigation");
                state.hasDialog = services.has("dialog");
                state.hasTemp = services.has("temp");
                state.hasUnknown = services.has("unknown-service");
            }
        };
    }
};
