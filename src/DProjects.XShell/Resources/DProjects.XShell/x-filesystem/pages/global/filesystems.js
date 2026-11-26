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
        icon: "x-filesystem",
        classes: ["embed-no-title"]
    },
    template: `
        <x-notice x-if="state.error" type="error" label="Filesystems" x-attr:message="state.error"></x-notice>

        <x-menuitem
            x-for="item in state.items"
            x-key="name"
            x-attr:label="item.label"
            x-attr:description="item.description || item.provider"
            x-attr:href="item.href"
            icon="x-filesystem"
            scope="global"
            open="top"
        ></x-menuitem>

        <x-empty x-if="state.ready && !state.error && state.items.length == 0"
            icon="x-filesystem"
            label="No filesystems"
            message="Register a filesystem to access it from here.">
        </x-empty>

        <x-menuitem label="-"></x-menuitem>
        <x-menuitem label="Manage filesystems" description="Add, configure or remove filesystems" icon="x-settings" href="page:x:/pages/workspace.js?menu-name=preferences&item=filesystems" open="stack"></x-menuitem>
        
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
