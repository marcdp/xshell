
export const contract = {
    description: "Demonstrates the x-dataset component.",
    events: {},
    properties: {},
    methods: {}
};

export default {
    template: `

        <p>
            The <code>x-dataset</code> component displays
            a DataSet as a collection of tables.
            Each table appears in its own tab and is rendered
            inside an <code>x-datatable</code> container.
        </p>

        <h2>1. Module dataset</h2>

        <p>
            Load the countries dataset from the x-demo module.
        </p>

        <pre x-pre><code>dataset:x-demo:countries</code></pre>

        <x-dataset x-prop:value="state.countries"></x-dataset>

        <p x-if="state.countriesError" class="error">
            {{ state.countriesError }}
        </p>

        <h2>2. Static dataset</h2>

        <p>
            Static datasets use compact key/value definitions.
        </p>

        <pre x-pre><code>dataset:static:A=Active|I=Inactive|S=Suspended</code></pre>

        <x-dataset x-prop:value="state.statuses"></x-dataset>

        <p x-if="state.statusesError" class="error">
            {{ state.statusesError }}
        </p>

        <h2>3. Multiple tables</h2>

        <p>
            A single DataSet can contain several tables.
            The component creates a tab for each one.
        </p>

        <x-dataset x-prop:value="state.multiple"></x-dataset>


        <h2>4. Select</h2>
        <p>
            A select field populated from the countries dataset.
        </p>
        <x-datafield type="select" label="Country" placeholder="Select a country" domain="dataset:x-demo:countries"></x-datafield>    
        <x-datafield type="radios" label="Priority" domain="dataset:x-demo:countries"></x-datafield>
        <x-datafield type="checkboxes" label="Notifications" domain="dataset:x-demo:countries" ></x-datafield>

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
