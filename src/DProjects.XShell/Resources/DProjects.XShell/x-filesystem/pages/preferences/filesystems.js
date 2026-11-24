export default {
    contract: {
        description: "Manage named Filesystem definitions."
    },

    meta: {
        title: "Filesystems",
        description: "Manage named filesystem connections.",
        icon: "x-folder"
    },

    template: `
        <x-notice x-if="state.error" type="error" label="Filesystems" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Working"></x-notice>

        <x-datafields x-if="state.ready">
            <x-datafield label="Filesystems" class="no-padding">
                <x-listview view="details" x-on:activate="edit">
                    <x-listview-head>
                        <x-listview-column label="Label" width="14em"></x-listview-column>
                        <x-listview-column label="Name" width="12em"></x-listview-column>
                        <x-listview-column label="Provider"></x-listview-column>
                        <x-listview-column label="Actions" width="5em" style="text-align:right">
                            <x-button class="anchor" icon="x-add" tooltip="Add filesystem" command="add" x-attr:disabled="state.busy"></x-button>
                        </x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.items" x-key="name" x-prop:value="item.name" icon="x-filesystem" x-attr:label="item.label">
                            <span x-text="item.name"></span>
                            <span x-text="item.provider"></span>
                            <div style="text-align:right">
                                <x-button class="anchor" icon="x-edit" tooltip="Edit"
                                    x-attr:data-name="item.name" x-on:click="edit" x-attr:disabled="state.busy"></x-button>
                                <x-button class="anchor" icon="x-close" tooltip="Delete"
                                    x-attr:data-name="item.name" x-on:click="remove" x-attr:disabled="state.busy"></x-button>
                            </div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>

                <x-empty x-if="state.items.length == 0" icon="x-folder"
                    label="No filesystems" message="Add a named filesystem connection.">
                    <x-button slot="actions" label="Add filesystem" icon="x-add" command="add"></x-button>
                </x-empty>
            </x-datafield>
        </x-datafields>
    `,

    state: {
        ready: false,
        busy: false,
        error: "",
        items: []
    },

    controller({state, filesystems, dialog}) {
        let alive = true;
        let refreshRevision = 0;

        return {
            async load() {
                // Load the current named filesystem definitions.
                await this.refresh();
            },

            unload() {
                // Prevent pending asynchronous operations from publishing after navigation.
                alive = false;
            },

            async refresh() {
                // Publish only the newest list request.
                const revision = ++refreshRevision;
                state.error = "";
                try {
                    const items = await filesystems.listDefinitions();
                    if (alive && revision === refreshRevision) state.items = items;
                } catch (error) {
                    if (alive && revision === refreshRevision) {
                        state.items = [];
                        state.error = error?.message || "Unable to load filesystems.";
                    }
                } finally {
                    if (alive && revision === refreshRevision) state.ready = true;
                }
            },

            async runAction(action) {
                // Serialize management mutations and dialogs.
                if (!alive || state.busy) return;
                state.busy = true;
                state.error = "";
                try {
                    await action();
                } catch (error) {
                    if (alive) state.error = error?.message || "The operation failed.";
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async openEditor(filesystemName = "") {
                // Refresh the list only after the detail Page confirms a successful save.
                await this.runAction(async () => {
                    const result = await dialog.open({
                        href: "page:x-filesystem:/pages/preferences/filesystems-detail.js",
                        title: filesystemName ? "Edit filesystem" : "Add filesystem",
                        context: filesystemName ? {filesystemName} : {}
                    });
                    if (alive && result?.saved === true) await this.refresh();
                });
            },

            async add() {
                // Open a fresh definition editor.
                await this.openEditor();
            },

            async edit({event}) {
                // Accept activation from the row or its explicit edit button.
                const name = event.detail?.value ?? event.currentTarget.dataset.name;
                if (name) await this.openEditor(name);
            },

            async remove({event}) {
                // Confirm deletion before removing the named registration.
                const name = event.currentTarget.dataset.name;
                const item = state.items.find(value => value.name === name);
                if (!item) return;

                await this.runAction(async () => {
                    const result = await dialog.confirm({
                        title: "Delete filesystem",
                        message: `Delete filesystem '${item.label}'?`
                    });
                    if (result !== "yes" || !alive) return;

                    await filesystems.removeDefinition(name);
                    if (alive) await this.refresh();
                });
            }
        };
    }
};
