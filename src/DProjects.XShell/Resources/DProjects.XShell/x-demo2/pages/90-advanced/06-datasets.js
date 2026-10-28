
export default {
    meta: {
        title: "DataSets",
        description: "Demonstrates DataSet resources, tables, rows, static data, and declarative loading."
    },

    dependencies: {
        statuses: "dataset:x-demo2:statuses"
    },

    template: `
        <p>DataSets are structured data resources loaded through XShell's Resolver and Loader. A DataSet contains one or more tables, each with a name, optional column metadata, and an array of rows.</p>

        <h2>DataSet structure</h2>
        <p>A DataSet is a plain JavaScript object containing a <code>tables</code> array.</p>
        <pre x-pre><code>{
    "tables": [
        {
            "name": "statuses",
            "columns": [
                {"name": "code", "type": "string"},
                {"name": "label", "type": "string"}
            ],
            "rows": [
                {"code": "A", "label": "Active"},
                {"code": "I", "label": "Inactive"}
            ]
        }
    ]
}</code></pre>
        <p>The first table, <code>tables[0]</code>, is the default table by convention. Its rows are ordinary JavaScript objects.</p>

        <h2>Module-owned DataSets</h2>
        <p>A Module can expose DataSets by placing JSON files in its <code>datasets</code> directory. This example uses the actual <code>x-demo2/datasets/statuses.json</code> file.</p>
        <pre x-pre><code>x-demo2/
    datasets/
        statuses.json

// Logical resource reference:
dataset:x-demo2:statuses</code></pre>
        <p>The Resolver maps the logical reference to the Module's dataset file, and the Loader fetches and validates its contents.</p>

        <h2>Loading a DataSet</h2>
        <p>Use <code>loader.load()</code> to load a DataSet dynamically.</p>
        <p>
            <x-button label="Load statuses" command="loadStatuses"></x-button>
            <x-button label="Clear results" command="clear"></x-button>
        </p>
        <p>Status: <strong>{{ state.status }}</strong></p>
        <ul>
            <li x-for="row in state.rows" x-key="code">
                <strong>{{ row.code }}</strong> — {{ row.label }}
            </li>
        </ul>
        <p x-if="state.rows.length == 0">No rows loaded.</p>
        <pre x-pre><code>const dataset = await loader.load("dataset:x-demo2:statuses");
const table = dataset.tables[0];
const rows = table.rows;</code></pre>

        <h2>Inspecting tables and columns</h2>
        <p>After loading a DataSet, you can inspect its table names, column definitions, and row counts.</p>
        <x-datafields columns="2">
            <x-datafield label="Table name">{{ state.tableName }}</x-datafield>
            <x-datafield label="Rows">{{ state.rowCount }}</x-datafield>
            <x-datafield label="Columns">{{ state.columnCount }}</x-datafield>
        </x-datafields>
        <ul>
            <li x-for="column in state.columns" x-key="name">
                {{ column.name }} — {{ column.type }}
            </li>
        </ul>
        <pre x-pre><code>const table = dataset.tables[0];

const name = table.name;
const columns = table.columns || [];
const rows = table.rows;</code></pre>
        <p>Column definitions describe the data but do not automatically convert or validate individual row values.</p>

        <h2>Inline static DataSets</h2>
        <p>Use <code>dataset:static:</code> to define a small list of key/value pairs directly in a resource reference.</p>
        <p><x-button label="Load static DataSet" command="loadStatic"></x-button></p>
        <ul>
            <li x-for="row in state.staticRows" x-key="key">
                {{ row.key }} — {{ row.value }}
            </li>
        </ul>
        <pre x-pre><code>const dataset = await loader.load(
    "dataset:static:A=Active|I=Inactive|S=Suspended"
);

// dataset.tables[0].name === "items"
// dataset.tables[0].rows[0] === {key:"A", value:"Active"}</code></pre>
        <p>Static DataSets always use an <code>items</code> table with <code>key</code> and <code>value</code> string columns.</p>

        <h2>Declarative dependencies</h2>
        <p>If a Page always needs a DataSet, declare it in <code>dependencies</code>. XShell loads it before constructing the Page controller.</p>
        <pre x-pre><code>export default {
    dependencies: {
        statuses: "dataset:x-demo2:statuses"
    },

    controller({dependencies, state}) {
        return {
            load() {
                state.rows = dependencies.statuses.tables[0].rows;
            }
        };
    }
};</code></pre>
        <p>This Page declares the statuses DataSet as a dependency. Its contents are already available to the controller when the Page loads.</p>
        <p>Declaratively available rows: <strong>{{ state.dependencyCount }}</strong></p>

        <h2>URL DataSets</h2>
        <p>The <code>dataset:url:</code> resource type loads DataSet-formatted JSON from an application-relative URL.</p>
        <pre x-pre><code>const dataset = await loader.load(
    "dataset:url:api/customers"
);</code></pre>
        <p>The endpoint must return valid DataSet JSON. XShell does not automatically transform arbitrary API responses into DataSet tables.</p>
        <p>For the built-in URL rule, use an application-relative path without a leading slash. Query parameters are not preserved by the current Resolver.</p>

        <h2>DataSet limitations</h2>
        <p>In the current implementation, DataSets are fully materialized JSON objects. They do not provide built-in querying, pagination, streaming, database relations, or persistent CRUD operations.</p>
        <p>Application code can read and transform the returned rows, but DataSets are not database connections or live data-source handles.</p>

        <h2>When to use DataSets</h2>
        <p>Use module-owned DataSets for reusable lookup tables and packaged application data. Use static DataSets for small fixed lists, and URL DataSets for structured JSON supplied by an endpoint.</p>
        <p>For more about how resources are resolved and loaded, see <x-anchor href="05-loading.js">Resolver and Loader</x-anchor>.</p>
    `,

    state: {
        status: "Ready",
        rows: [],
        staticRows: [],
        tableName: "",
        rowCount: 0,
        columnCount: 0,
        columns: [],
        dependencyCount: 0
    },

    controller({loader, dependencies, state}) {
        return {
            load() {
                state.dependencyCount =
                    dependencies.statuses.tables[0].rows.length;
            },

            async loadStatuses() {
                state.status = "Loading statuses...";

                try {
                    const dataset = await loader.load(
                        "dataset:x-demo2:statuses"
                    );

                    const table = dataset.tables[0];

                    state.rows = table.rows;
                    state.tableName = table.name;
                    state.columns = table.columns || [];
                    state.rowCount = table.rows.length;
                    state.columnCount = state.columns.length;
                    state.status = "Statuses loaded";
                } catch (error) {
                    state.status = "Load failed: " + error.message;
                    this.clearResults();
                }
            },

            async loadStatic() {
                try {
                    const dataset = await loader.load(
                        "dataset:static:A=Active|I=Inactive|S=Suspended"
                    );

                    state.staticRows = dataset.tables[0].rows;
                } catch (error) {
                    state.status = "Static DataSet failed: " + error.message;
                    state.staticRows = [];
                }
            },

            clear() {
                this.clearResults();
                state.staticRows = [];
                state.status = "Ready";
            },

            clearResults() {
                state.rows = [];
                state.tableName = "";
                state.columns = [];
                state.rowCount = 0;
                state.columnCount = 0;
            }
        };
    }
};
