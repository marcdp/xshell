
export const contract = {
    description: "Displays the tables of a DataSet using a tabbed interface.",
    events: {},
    properties: {
        value: {type: "object", default: null, state: true, description: "DataSet object to display."}
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
                                    {{ row[column.name] }}
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

    controller({ state, events }) {
        return {
            load() {
                events.on(state, "change:value", () => {
                    this.refresh();
                });
                this.refresh();
            },

            refresh() {
                const dataset = state.value;

                if (!dataset || !Array.isArray(dataset.tables)) {
                    state.tables = [];
                    return;
                }

                state.tables = dataset.tables.map(table => {
                    const rows = Array.isArray(table.rows)
                        ? table.rows
                        : [];

                    const columns = table.columns?.length
                        ? table.columns
                        : Object.keys(rows[0] || {}).map(name => ({
                            name
                        }));

                    return {
                        name: table.name,
                        columns,
                        rows
                    };
                });
            }
        };
    }
};
