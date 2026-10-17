
export const contract = {
    description: "Demonstrates the x-dataset component.",
    events: {},
    properties: {},
    methods: {}
};

export default {
    template: `
        <h2>Dataset component</h2>

        <p>
            The <code>x-dataset</code> component displays
            a DataSet as a collection of tables.
            Each table appears in its own tab and is rendered
            inside an <code>x-datatable</code> container.
        </p>

        <h3>1. Module dataset</h3>

        <p>
            Load the countries dataset from the x-demo module.
        </p>

        <pre x-pre><code>dataset:x-demo:countries</code></pre>

        <x-dataset x-prop:value="state.countries"></x-dataset>

        <p x-if="state.countriesError" class="error">
            {{ state.countriesError }}
        </p>

        <h3>2. Static dataset</h3>

        <p>
            Static datasets use compact key/value definitions.
        </p>

        <pre x-pre><code>dataset:static:A=Active|I=Inactive|S=Suspended</code></pre>

        <x-dataset x-prop:value="state.statuses"></x-dataset>

        <p x-if="state.statusesError" class="error">
            {{ state.statusesError }}
        </p>

        <h3>3. Multiple tables</h3>

        <p>
            A single DataSet can contain several tables.
            The component creates a tab for each one.
        </p>

        <x-dataset x-prop:value="state.multiple"></x-dataset>
    `,

    state: {
        countries: null,
        countriesError: "",
        statuses: null,
        statusesError: "",
        multiple: {
            tables: [
                {
                    name: "customers",
                    columns: [
                        { name: "id", type: "integer" },
                        { name: "name", type: "string" }
                    ],
                    rows: [
                        { id: 1, name: "Acme" },
                        { id: 2, name: "Contoso" }
                    ]
                },
                {
                    name: "orders",
                    columns: [
                        { name: "id", type: "integer" },
                        { name: "customerId", type: "integer" },
                        { name: "total", type: "number" }
                    ],
                    rows: [
                        { id: 101, customerId: 1, total: 250 },
                        { id: 102, customerId: 2, total: 480 }
                    ]
                }
            ]
        }
    },

    controller({ state, loader }) {
        return {
            async load() {
                try {
                    state.countries = await loader.load(
                        "dataset:x-demo:countries"
                    );
                } catch (error) {
                    state.countriesError = error.message || String(error);
                }

                try {
                    state.statuses = await loader.load(
                        "dataset:static:A=Active|I=Inactive|S=Suspended"
                    );
                } catch (error) {
                    state.statusesError = error.message || String(error);
                }
            }
        };
    }
};
