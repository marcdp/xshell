
export default {
    meta: {
        title: "Module Controller",
        description: "Understand optional Module controllers, startup behavior, and module-wide state."
    },

    template: `
        <p>A Module can include an optional <code>module.js</code> controller. It provides Module-wide behavior that is initialized independently of individual Pages.</p>

        <h2>Creating a Module controller</h2>
        <p>Place <code>module.js</code> at the Module root and default-export a class.</p>
        <x-code language="javascript" x-pre>export default class {
    constructor({moduleConfig}) {
        this.id = moduleConfig.id;
        this.label = moduleConfig.label;
    }

    start() {
        // Module startup logic.
    }

    stop() {
        // Optional shutdown logic.
    }
}</x-code>
        <p>XShell discovers the controller through the Module's file inventory, creates an instance, and invokes its <code>start()</code> method during Module initialization.</p>

        <h2>Constructor injection</h2>
        <p>Module controllers receive dependencies through constructor injection. The special <code>moduleConfig</code> argument provides the Module's effective configuration, while <code>services</code> is the controller's own Services scope.</p>
        <x-code language="javascript" x-pre>constructor({moduleConfig, services, navigation}) {
    this.id = moduleConfig.id;
    this.files = moduleConfig.files;
    this.assetsPath = moduleConfig.assets.path;
    this.services = services;
    this.navigation = navigation;
}</x-code>
        <p>Other registered services can also be requested by name. They resolve through one direct-root scope owned for the lifetime of this Module controller. Singletons remain shared, repeated scoped resolution returns the same instance within this controller, and transient resolution creates a new instance.</p>

        <h2>Lifecycle</h2>
        <p>A Module controller can implement <code>start()</code> and <code>stop()</code>. These methods belong to the Module lifecycle, not the lifecycle of an individual Page.</p>
        <x-code language="text" x-pre>Module initialization
    |
    +-- Create runtime Module
    +-- Construct optional module.js controller
    +-- Invoke start()
    |
    v
Application running
    |
    v
Module shutdown
    |
    +-- Invoke stop() if implemented
    +-- Dispose controller Services scope</x-code>
        <p>The scope stays active through <code>stop()</code>. It is independent of Page, Component, and Command scopes. A Module controller is not recreated each time a Page in that Module is opened, and a Module without a controller creates no scope.</p>

        <h2>The cookbook controller</h2>
        <p>The actual <code>x-demo/module.js</code> stores Module information and prepares a summary of its Page resources during startup.</p>
        <x-code language="javascript" x-pre>export default class {
    constructor({moduleConfig}) {
        this.id = moduleConfig.id;
        this.label = moduleConfig.label;
        this.menuSource = moduleConfig.menus.navigation.source;
        this.files = moduleConfig.files || [];
        this.assetsPath = moduleConfig.assets?.path || "";
        this.pageCount = 0;
        this.started = false;
    }

    start() {
        this.pageCount = this.files.filter(file =>
            file.path.startsWith(this.assetsPath + "/pages/") &&
            /\\.(js|html)$/.test(file.path)
        ).length;

        this.started = true;
    }
}</x-code>
        <p>The real controller also exposes <code>getCookbookSummary()</code>, which returns the information displayed below.</p>

        <h2>Live Module summary</h2>
        <x-button label="Read module summary" command="refresh"></x-button>
        <x-datafields columns="2">
            <x-datafield label="Module ID">{{ state.id }}</x-datafield>
            <x-datafield label="Label">{{ state.label }}</x-datafield>
            <x-datafield label="Controller started">{{ state.started }}</x-datafield>
            <x-datafield label="Page resources">{{ state.pageCount }}</x-datafield>
            <x-datafield label="Navigation source">{{ state.menuSource }}</x-datafield>
        </x-datafields>
        <x-code language="javascript" x-pre>controller({moduleController, state}) {
    return {
        load() {
            this.refresh();
        },
        refresh() {
            const summary = moduleController.getCookbookSummary();
            state.id = summary.id;
            state.label = summary.label;
            state.started = summary.started;
            state.pageCount = summary.pageCount;
            state.menuSource = summary.menuSource;
        }
    };
}</x-code>

        <h2>Module versus Page controllers</h2>
        <x-datafields columns="2">
            <x-datafield label="Module controller">Manages Module-wide initialization and behavior.</x-datafield>
            <x-datafield label="Page controller">Manages behavior and state for a particular Page.</x-datafield>
            <x-datafield label="Module lifecycle">Runs during Module initialization and shutdown.</x-datafield>
            <x-datafield label="Page lifecycle">Runs as the Page is created, loaded, and unloaded.</x-datafield>
        </x-datafields>
        <p>Use a Module controller when behavior belongs to the Module as a whole. Ordinary Page interactions should remain in Page controllers.</p>

        <p>Continue with <x-anchor href="05-menus.js">Menus and Areas</x-anchor> to learn how a Module contributes navigation.</p>
    `,

    state: {
        id: "",
        label: "",
        started: false,
        pageCount: 0,
        menuSource: ""
    },
 
    controller({moduleController, state}) {
        return {
            load() {
                this.refresh();
            },

            refresh() {
                const summary = moduleController.getCookbookSummary();

                state.id = summary.id;
                state.label = summary.label;
                state.started = summary.started;
                state.pageCount = summary.pageCount;
                state.menuSource = summary.menuSource;
            }
        };
    }
};
