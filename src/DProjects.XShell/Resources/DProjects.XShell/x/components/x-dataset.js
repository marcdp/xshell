
export const contract = {
    description: "Displays the tables of a DataSet using a tabbed interface.",
    events: {},
    properties: {
        value: {type: "object", default: null, state: true, description: "DataSet object to display."},
        src: {type: "string", attribute:true, state:true, default: "", description: "Source URL for the dataset."}
    },
    methods: {}
};

export default {
    style: `
        :host {
            display: block;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: .5em .75em;
            text-align: left;
            border-bottom: 1px solid var(--x-accordion-border);
        }

        th {
            font-weight: 600;
        }

        tbody tr:nth-child(odd) {
            background-color: var(--x-color-background-alt);
        }

        .empty {
            padding: 1em;
        }
    `,

    template: `
        <div x-if="state.tables.length == 0" class="empty">
            No tables available.
        </div>

        <x-tabs x-if="state.tables.length > 0">
            <x-tab x-for="table in state.tables" x-attr:label="table.name">
                <x-datatable>
                    <table>
                        <thead>
                            <tr>
                                <th x-for="column in table.columns">
                                    {{ column.label || column.name }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr x-for="row in table.rows">
                                <td x-for="column in table.columns">
                                    {{ row[column.name] | stringify}}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </x-datatable>
                <p x-if="table.rows.length == 0">
                    No rows available.
                </p>
            </x-tab>
        </x-tabs>
    `,

    state: {
        tables: []
    },

    controller({ state, events, loader }) {
        let sourceRevision = 0;
        let sourceOwnsValue = false;
        let updatingFromSource = false;

        return {
            async load() {
                // load
                events.on(state, "change:value", () => {
                    if (!updatingFromSource) {
                        ++sourceRevision;
                        sourceOwnsValue = false;
                    }
                    this.refresh();
                });
                events.on(state, "change:src", () => {
                    this.loadSource().catch(error => {
                        console.error("x-dataset: failed to load source", error);
                    });
                });
                this.refresh();
                if (state.src) await this.loadSource();
            },
            async loadSource() {
                const revision = ++sourceRevision;
                const src = state.src;
                if (!src) {
                    if (sourceOwnsValue) {
                        updatingFromSource = true;
                        try {
                            state.value = null;
                        } finally {
                            updatingFromSource = false;
                        }
                    }
                    sourceOwnsValue = false;
                    return;
                }
                try {
                    const value = await loader.load(src);
                    if (revision !== sourceRevision) return;
                    sourceOwnsValue = true;
                    updatingFromSource = true;
                    try {
                        state.value = value;
                    } finally {
                        updatingFromSource = false;
                    }
                } catch (error) {
                    if (revision === sourceRevision) throw error;
                }
            },
            refresh() {
                // refresh
                const dataset = state.value;
                if (!dataset || !Array.isArray(dataset.tables)) {
                    state.tables = [];
                    return;
                }
                state.tables = dataset.tables.map(table => {
                    const rows = Array.isArray(table.rows) ? table.rows : [];
                    const columns = table.columns?.length ? table.columns : Object.keys(rows[0] || {}).map(name => ({name}));
                    return { name: table.name, columns, rows };
                });
            }
        };
    }
};
