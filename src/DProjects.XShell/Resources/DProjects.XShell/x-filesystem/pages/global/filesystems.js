// page
export default {
    contract: {
        description: "Displays registered filesystems for global navigation.",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Filesystems",
        icon: "x-filesystem"
    },
    template: `
        <p x-if="!state.ready">Loading filesystems...</p>

        <x-notice x-if="state.error" type="error" label="Filesystems" x-attr:message="state.error"></x-notice>

        <x-listview x-if="state.items.length > 0" view="tiles">
            <x-listview-head></x-listview-head>
            <x-listview-body>
                <x-listview-item
                    x-for="item in state.items"
                    x-key="name"
                    x-attr:label="item.label"
                    x-attr:description="item.description || item.provider"
                    x-attr:href="item.href"
                    icon="x-filesystem"
                    open="top"
                ></x-listview-item>
            </x-listview-body>
        </x-listview>

        <x-empty x-if="state.ready && !state.error && state.items.length == 0"
            icon="x-filesystem"
            label="No filesystems"
            message="Register a filesystem to access it from here.">
        </x-empty>

        <hr>

        <!--
        <x-menuitem label="-"></x-menuitem>
        <x-menuitem label="Manage filesystems" description="Lorem ipsum" icon="x-settings" href="page:x-filesystem:/pages/preferences/filesystems.js" open="stack">
        </x-menuitem>
        
        -->

        <x-listview view="tiles">
            <x-listview-body>
                <x-listview-item
                    label="Manage filesystems"
                    description="Add, configure or remove filesystems."
                    icon="x-settings"
                    href="page:x-filesystem:/pages/preferences/filesystems.js"
                    open="stack"
                ></x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        ready: false,
        error: "",
        items: []
    },
    controller({ state, events, bus, filesystems }) {
        let alive = true;
        let revision = 0;

        return {
            async load() {
                // Subscribe to filesystem registration changes.
                events.on(bus, "filesystems:definitions-changed", "refresh");
                await this.refresh();
            },

            unload() {
                // Prevent pending requests from updating an unloaded Page.
                alive = false;
            },

            async refresh() {
                // Load registered filesystems and build their navigation targets.
                const currentRevision = ++revision;
                state.error = "";

                try {
                    const definitions = await filesystems.listDefinitions();
                    if (!alive || currentRevision !== revision) return;

                    state.items = definitions.map(item => ({
                        name: item.name,
                        label: item.label,
                        description: item.description,
                        provider: item.provider,
                        href: "page:x-filesystem:/pages/explorer.js?src=" + encodeURIComponent("named:" + item.name) + "&path=%2F"
                    }));
                } catch (error) {
                    if (!alive || currentRevision !== revision) return;
                    state.items = [];
                    state.error = error?.message || "Unable to load filesystems.";
                } finally {
                    if (alive && currentRevision === revision) state.ready = true;
                }
            }
        };
    }
};
