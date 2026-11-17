export default {
    contract: {
        description: "Manage browser-local preferences.",
        properties: {
            mode: {type:"string", default:"manage", state:true, context:true},
            preferenceName: {type:"string", default:"", state:true, context:true}
        }
    },

    meta: {title:"Preferences", icon:"x-settings"},

    style: `
        :scope {display:block;}
        .toolbar {display:flex; align-items:end; gap:.5em; margin-bottom:1em;}
        .toolbar x-datafield {flex:1;}
        .hint {color:var(--x-color-gray);}
        .actions {text-align:right;}
    `,

    template: `
        <x-notice x-if="state.error" type="error" label="Error" x-attr:message="state.error"></x-notice>
        <x-notice x-if="state.busy" type="working" label="Loading preferences"></x-notice>

        <!-- Preferences list -->
        <x-form x-if="state.mode == 'manage' && state.ready && !state.busy" command="refresh">
            <div class="toolbar">
                <x-datafield type="text" label="Key prefix" x-model="state.prefix" description="Leave empty to list every preference"></x-datafield>
                <x-button label="Filter" command="refresh" x-attr:disabled="state.busy"></x-button>
            </div>

            <x-empty x-if="state.items.length == 0" icon="x-settings" label="No preferences" message="No preferences match this key prefix."></x-empty>

            <x-listview x-if="state.items.length > 0" view="details">
                <x-listview-head>
                    <x-listview-column label="Label"></x-listview-column>
                    <x-listview-column label="Name"></x-listview-column>
                    <x-listview-column label="Value"></x-listview-column>
                    <x-listview-column label="Description"></x-listview-column>
                    <x-listview-column label="Revision"></x-listview-column>
                    <x-listview-column label="Created"></x-listview-column>
                    <x-listview-column label="Modified"></x-listview-column>
                    <x-listview-column label="Actions" slot="right" width="5em"></x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="item in state.items" x-attr:key="item.id" x-attr:path="item.id" x-attr:label="item.label" icon="x-settings">
                        <span x-text="item.name"></span>
                        <span x-text="item.valueSummary"></span>
                        <span x-text="item.description || '—'"></span>
                        <span x-text="item.revision"></span>
                        <span x-text="item.createdDisplay"></span>
                        <span x-text="item.modifiedDisplay"></span>
                        <div class="actions">
                            <x-button class="plain" icon="x-edit" tooltip="Edit" x-attr:data-name="item.name" x-on:click="edit"></x-button>
                            <x-button class="plain" icon="x-trash" tooltip="Delete" x-attr:data-name="item.name" x-on:click="remove"></x-button>
                        </div>
                    </x-listview-item>
                </x-listview-body>
            </x-listview>
            <x-button slot="footer" label="Add preference" icon="x-add" command="add" x-attr:disabled="state.busy"></x-button>
        </x-form>

        <!-- Add and edit dialog -->
        <x-form x-if="(state.mode == 'add' || state.mode == 'edit') && state.ready" command="save">
            <x-datafields>
                <x-datafield x-if="state.mode == 'add'" type="text" label="Name" required autofocus x-model="state.preferenceName" description="Unique, case-sensitive preference key"></x-datafield>
                <x-datafield x-if="state.mode == 'edit'" type="text" label="Name" readonly x-model="state.preferenceName" description="Delete and recreate the preference to change its name"></x-datafield>
                <x-datafield type="text" label="Label" x-model="state.label" description="Optional friendly display name"></x-datafield>
                <x-datafield type="textarea" label="Description" x-model="state.description"></x-datafield>
                <x-datafield x-if="!state.readonlyValue" type="select" label="Value type" x-prop:domain="state.valueTypes" x-model="state.valueType"></x-datafield>
                <x-datafield x-if="state.valueType == 'text' && !state.readonlyValue" type="textarea" label="Value" x-model="state.editorValue"></x-datafield>
                <x-datafield x-if="state.valueType == 'json' && !state.readonlyValue" type="textarea" label="JSON value" required x-model="state.editorValue"></x-datafield>
                <x-datafield x-if="state.readonlyValue" type="text" label="Value" readonly x-model="state.valueSummary" description="This browser-native value is read-only here; metadata edits preserve the original value"></x-datafield>
            </x-datafields>
            <x-details x-if="state.mode == 'edit'" label="Metadata">
                <x-datafields columns="2">
                    <x-datafield type="text" label="Created" readonly x-model="state.createdDisplay"></x-datafield>
                    <x-datafield type="text" label="Modified" readonly x-model="state.modifiedDisplay"></x-datafield>
                    <x-datafield type="text" label="Revision" readonly x-model="state.revision"></x-datafield>
                </x-datafields>
            </x-details>
            <p class="hint" x-if="state.readonlyValue">Saving changes only the label and description and keeps the stored structured-clone value intact.</p>
            <x-button slot="footer" class="submit" label="Save" command="save" x-attr:disabled="state.busy"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>
    `,

    state: {
        mode: "manage",
        preferenceName: "",
        ready: false,
        busy: false,
        error: "",
        prefix: "",
        items: [],
        label: "",
        description: "",
        createdDisplay: "",
        modifiedDisplay: "",
        revision: null,
        readonlyValue: false,
        valueType: "text",
        valueSummary: "",
        editorValue: "",
        valueTypes: [
            {value:"text", label:"Text"},
            {value:"json", label:"JSON"}
        ]
    },

    controller({state, page, preferences, dialog}) {
        let alive = true;
        let originalValue;

        return {
            message(error) {
                // Normalize browser and service failures for the Page error notice.
                return error?.message || "The operation failed.";
            },

            formatDate(value) {
                // Display valid timestamps using the user's locale without changing persisted UTC values.
                const date = new Date(value);
                return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
            },

            isJsonEditable(value, seen = new WeakSet()) {
                // Accept only values whose JSON edit round-trip cannot silently change their type or data.
                if (value === null || typeof value === "string" || typeof value === "boolean") return true;
                if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
                if (typeof value !== "object" || seen.has(value)) return false;
                seen.add(value);
                if (Array.isArray(value)) {
                    if (Object.keys(value).some(key => !/^\d+$/u.test(key))) return false;
                    for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
                    return value.every(item => this.isJsonEditable(item, seen));
                }
                const prototype = Object.getPrototypeOf(value);
                if (prototype !== Object.prototype && prototype !== null) return false;
                if (Object.getOwnPropertySymbols(value).length) return false;
                return Object.values(value).every(item => this.isJsonEditable(item, seen));
            },

            valueKind(value) {
                // Select an editor only when its round-trip preserves the stored value's semantics.
                if (typeof value === "string") return "text";
                return this.isJsonEditable(value) ? "json" : "readonly";
            },

            summarizeValue(value) {
                // Produce a safe summary without serializing values that may be cyclic or browser-native.
                if (value === undefined) return "undefined";
                if (value === null) return "null";
                if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}…` : value;
                if (["number", "boolean", "bigint"].includes(typeof value)) return String(value);
                if (value instanceof Date) return `Date (${Number.isNaN(value.getTime()) ? "invalid" : value.toISOString()})`;
                if (value instanceof Map) return `Map (${value.size} entries)`;
                if (value instanceof Set) return `Set (${value.size} entries)`;
                if (value instanceof ArrayBuffer) return `ArrayBuffer (${value.byteLength} bytes)`;
                if (ArrayBuffer.isView(value)) return `${value.constructor.name} (${value.byteLength} bytes)`;
                if (typeof Blob !== "undefined" && value instanceof Blob) return `${value.constructor.name} (${value.size} bytes, ${value.type || "unknown type"})`;
                if (Array.isArray(value)) return `Array (${value.length} items)`;
                const type = value?.constructor?.name || "Object";
                if (typeof value?.kind === "string" && typeof value?.name === "string") return `${type} (${value.kind}: ${value.name})`;
                return type;
            },

            clearEditor() {
                // Release the currently loaded value and reset all editor-only state.
                originalValue = undefined;
                state.label = "";
                state.description = "";
                state.createdDisplay = "";
                state.modifiedDisplay = "";
                state.revision = null;
                state.readonlyValue = false;
                state.valueType = "text";
                state.valueSummary = "";
                state.editorValue = "";
            },

            async load() {
                // Load either the list or the selected record according to the Page context.
                if (state.mode == "manage") return await this.refresh();
                if (state.mode == "add") {
                    state.ready = true;
                    return;
                }
                if (state.mode != "edit") return void (state.error = "Unsupported Preferences Page mode.");

                state.busy = true;
                try {
                    const record = (await preferences.list(state.preferenceName)).find(item => item.name === state.preferenceName);
                    if (!alive) return;
                    if (!record) throw new Error("Preference not found.");
                    originalValue = record.value;
                    state.label = record.label;
                    state.description = record.description;
                    state.createdDisplay = this.formatDate(record.createdAt);
                    state.modifiedDisplay = this.formatDate(record.modifiedAt);
                    state.revision = record.revision;
                    state.valueSummary = this.summarizeValue(record.value);
                    state.valueType = this.valueKind(record.value);
                    state.readonlyValue = state.valueType == "readonly";
                    state.editorValue = state.valueType == "text" ? record.value : state.valueType == "json" ? JSON.stringify(record.value, null, 2) : "";
                    state.ready = true;
                } catch (error) {
                    if (alive) state.error = this.message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            unload() {
                // Ignore late asynchronous completions and release structured-clone values held by the editor.
                alive = false;
                originalValue = undefined;
                state.items = [];
            },

            async refresh() {
                // Apply the current prefix through the service and prepare display-only list records.
                state.busy = true;
                try {
                    const records = await preferences.list(state.prefix);
                    if (!alive) return;
                    state.items = records.map(record => ({
                        id: record.id,
                        name: record.name,
                        label: record.label,
                        description: record.description,
                        revision: record.revision,
                        createdDisplay: this.formatDate(record.createdAt),
                        modifiedDisplay: this.formatDate(record.modifiedAt),
                        valueSummary: this.summarizeValue(record.value)
                    }));
                    state.error = "";
                } catch (error) {
                    if (alive) {
                        state.items = [];
                        state.error = this.message(error);
                    }
                } finally {
                    if (alive) {
                        state.ready = true;
                        state.busy = false;
                        page.invalidate();
                    }
                }
            },

            async openEditor(mode, name = "") {
                // Open add and edit flows as ordinary XShell Page dialogs.
                try {
                    const result = await dialog.open({
                        href: "page:x:/pages/preferences.js",
                        title: mode == "add" ? "Add preference" : "Edit preference",
                        context: {mode, preferenceName:name}
                    });
                    if (alive && result?.saved) await this.refresh();
                } catch (error) {
                    if (alive) state.error = this.message(error);
                }
            },

            async add() {
                // Open a blank editor for a new preference.
                await this.openEditor("add");
            },

            async edit({event}) {
                // Open the immutable name selected by the list action.
                const name = event.currentTarget.dataset.name;
                if (name) await this.openEditor("edit", name);
            },

            async save() {
                // Parse only explicitly editable values and preserve read-only native values verbatim.
                if (state.busy) return;
                const name = state.preferenceName;
                if (!name.trim()) return void (state.error = "Preference name is required.");
                let value = originalValue;
                if (!state.readonlyValue) {
                    value = state.editorValue;
                    if (state.valueType == "json") {
                        try { value = JSON.parse(state.editorValue); }
                        catch { state.error = "The value must contain valid JSON."; return; }
                    }
                }

                state.error = "";
                state.busy = true;
                try {
                    if (state.mode == "add") {
                        const duplicate = (await preferences.list(name)).some(item => item.name === name);
                        if (duplicate) throw new Error("A preference with this name already exists.");
                    }
                    const metadata = {description:state.description};
                    if (state.mode == "edit" || state.label !== "") metadata.label = state.label;
                    await preferences.set(name, value, metadata);
                    if (!alive) return;
                    this.clearEditor();
                    await page.close({saved:true});
                } catch (error) {
                    if (alive) state.error = this.message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async remove({event}) {
                // Confirm destructive changes and refresh only after the delete transaction commits.
                if (state.busy) return;
                const name = event.currentTarget.dataset.name;
                if (!name) return;
                try {
                    const result = await dialog.confirm({title:"Delete preference", message:`Delete preference '${name}'?`});
                    if (result != "yes" || !alive) return;
                    state.busy = true;
                    state.error = "";
                    await preferences.delete(name);
                    if (alive) await this.refresh();
                } catch (error) {
                    if (alive) state.error = this.message(error);
                } finally {
                    if (alive) state.busy = false;
                }
            },

            async cancel() {
                // Close the dialog without persisting editor state.
                this.clearEditor();
                await page.close(null);
            }
        };
    }
};
