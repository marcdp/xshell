const dateTime = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3
});

// component
export default {
    contract: {
        description: "Displays and inspects stored log records in the supplied order.",
        properties: {
            records: {type: "array", default: [], state: true, description: "The current log records, in display order."},
            autoScroll: {type: "boolean", default: false, attribute: true, state: true, description: "Follow the newest row at the bottom of the list."}
        }
    },
    style: `
        :host {display:block; min-inline-size:0;}
        .log-list {max-block-size:min(45vh, 24rem); overflow:auto;}
        .log-cell {overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
        .warn {color:var(--x-color-secondary-x-dark); font-weight:600;}
        .error {color:var(--x-color-error); font-weight:600;}
        .log-inspector {overflow-wrap:anywhere; margin-block:.5em;}
    `,
    template: `
        <div class="log-list">
            <x-listview view="details" aria-label="Log records" x-attr:auto-scroll="state.autoScroll" x-on:select="select">
                <x-listview-head>
                    <x-listview-column label="Timestamp" width="minmax(10em, 17em)"></x-listview-column>
                    <x-listview-column label="Level" width="4.5em"></x-listview-column>
                    <x-listview-column label="Category" width="minmax(5em, .75fr)"></x-listview-column>
                    <x-listview-column label="Message"></x-listview-column>
                </x-listview-head>
                <x-listview-body>
                    <x-listview-item x-for="row in state.rows" x-key="id" x-prop:value="row.id"
                        x-attr:label="row.time" x-attr:icon="row.icon" x-prop:selected="row.id == state.selectedId">
                        <span x-attr:class="'log-cell ' + row.level" x-text="row.level"></span>
                        <span class="log-cell" x-attr:title="row.category" x-text="row.category"></span>
                        <span class="log-cell" x-attr:title="row.preview" x-text="row.preview"></span>
                    </x-listview-item>
                </x-listview-body>
            </x-listview>
        </div>
        <section class="log-inspector" aria-label="Selected record" x-if="state.selected">
            <time x-attr:datetime="state.selected.iso" x-text="state.selected.time"></time>
            <span x-text="state.selected.level"></span>
            <span x-text="state.selected.category"></span>
            <x-object name="Arguments" expanded x-prop:value="state.selected.args"></x-object>
        </section>
    `,
    state: {rows: [], selectedId: null, selected: null},
    controller({state, events, host, postRender}) {
        return {
            load() {
                // Reconcile selection against fresh records, including records that reuse an identifier.
                events.on(state, "change:records", "refresh");
                this.refresh();
            },
            refresh() {
                const previous = state.rows;
                state.rows = (state.records ?? []).map(record => this.present(record));
                this.selectRecord(state.selectedId);

                // Listview follows growth. Also follow the first window and a moving tail at capacity.
                const tail = state.rows.at(-1);
                const previousTail = previous.at(-1);
                const tailChanged = tail && (tail.id !== previousTail?.id || tail.timestamp !== previousTail?.timestamp);
                if (state.autoScroll && tailChanged && (!previousTail || state.rows.length <= previous.length)) postRender("followTail");
            },
            followTail() {
                if (!state.autoScroll || !host.checkVisibility()) return;
                host.shadowRoot.querySelector("x-listview-item:last-child")?.scrollIntoView({block: "end", behavior: "smooth"});
            },
            select({event}) {
                this.selectRecord(event.detail.value);
            },
            selectRecord(id) {
                const row = state.rows.find(record => record.id === id);
                state.selectedId = row?.id ?? null;
                state.selected = row ?? null;
            },
            present({id, timestamp, level, category, args}) {
                // Format display fields without rewriting or serializing the stored argument array.
                const date = typeof timestamp === "number" ? new Date(timestamp) : null;
                const valid = date && Number.isFinite(date.getTime());
                const value = args[0];
                let preview;
                if (!args.length) preview = "(no arguments)";
                else if (value instanceof Error) preview = value.name + ": " + value.message;
                else if (Array.isArray(value)) preview = "Array(" + value.length + ")";
                else if (value && typeof value === "object") preview = value.unserializable === true ? "[Unserializable]" : Object.prototype.toString.call(value);
                else preview = typeof value === "bigint" ? String(value) + "n" : String(value);
                if (preview.length > 240) preview = preview.slice(0, 239) + "…";
                const icon = level === "error" ? "x-error" : level === "warn" ? "x-warning" : "x-file";
                return {id, timestamp, level, icon, category: category === "Uncategorized" ? "Uncategorized (named category)" : category ?? "Uncategorized",
                    args, preview, time: valid ? dateTime.format(date) : "Invalid timestamp", iso: valid ? date.toISOString() : null};
            }
        };
    }
};
