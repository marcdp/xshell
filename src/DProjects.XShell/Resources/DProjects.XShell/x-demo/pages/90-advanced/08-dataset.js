
export const contract = {
    description: "Dataset loading demonstration",
    events: {},
    properties: {},
    methods: {}
};

export default {
    template: `
        <h2>Datasets</h2>

        <p>
            Datasets are logical resources loaded through the
            XShell Resolver and Loader. Every dataset returns
            the same DataSet structure.
        </p>

        <h3>1. Static dataset</h3>

        <p>
            Inline key/value pairs are useful for small domains,
            such as select boxes and status values.
        </p>

        <pre x-pre><code>dataset:static:A=Active|I=Inactive|S=Suspended</code></pre>

        <button x-on:click="loadStatic">
            Load static dataset
        </button>

        <p x-if="state.staticError" class="error">
            {{ state.staticError }}
        </p>

        <div x-if="state.staticData">
            <h4>Result</h4>

            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr x-for="row in state.staticRows">
                        <td>{{ row.key }}</td>
                        <td>{{ row.value }}</td>
                    </tr>
                </tbody>
            </table>

            <h4>DataSet JSON</h4>
            <pre>{{ state.staticJson }}</pre>
        </div>

        <h3>2. Module dataset</h3>

        <p>
            Modules can expose JSON datasets through the
            conventional /datasets directory.
        </p>

        <pre x-pre><code>dataset:x-demo:countries</code></pre>

        <button x-on:click="loadCountries">
            Load countries dataset
        </button>

        <p x-if="state.countriesError" class="error">
            {{ state.countriesError }}
        </p>

        <div x-if="state.countriesData">
            <h4>Result</h4>

            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Country</th>
                    </tr>
                </thead>
                <tbody>
                    <tr x-for="row in state.countriesRows">
                        <td>{{ row.code }}</td>
                        <td>{{ row.name }}</td>
                    </tr>
                </tbody>
            </table>

            <h4>DataSet JSON</h4>
            <pre>{{ state.countriesJson }}</pre>
        </div>
    `,

    state: {
        staticData: null,
        staticRows: [],
        staticJson: "",
        staticError: "",

        countriesData: null,
        countriesRows: [],
        countriesJson: "",
        countriesError: ""
    },

    controller({ state, loader }) {
        return {
            async load() {
                await Promise.all([
                    this.loadStatic(),
                    this.loadCountries()
                ]);
            },

            async loadStatic() {
                state.staticError = "";

                try {
                    const dataset = await loader.load(
                        "dataset:static:A=Active|I=Inactive|S=Suspended"
                    );

                    state.staticRows = dataset.tables[0].rows;
                    state.staticJson = JSON.stringify(dataset, null, 2);
                    state.staticData = dataset;
                } catch (error) {
                    state.staticData = null;
                    state.staticError = error.message || String(error);
                }
            },

            async loadCountries() {
                state.countriesError = "";

                try {
                    const dataset = await loader.load(
                        "dataset:x-demo:countries"
                    );

                    state.countriesRows = dataset.tables[0].rows;
                    state.countriesJson = JSON.stringify(dataset, null, 2);
                    state.countriesData = dataset;
                } catch (error) {
                    state.countriesData = null;
                    state.countriesError = error.message || String(error);
                }
            }
        };
    }
};
