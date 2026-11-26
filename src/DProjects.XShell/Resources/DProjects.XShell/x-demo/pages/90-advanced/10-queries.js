export default {
    meta: {
        title: "Queries",
        description: "Discovers read-only Queries and displays their returned values."
    },

    template: `
        <p>Discover Queries with <code>queries.list()</code> and await <code>queries.run()</code> to get the result.</p>
        <x-code language="javascript" x-pre>const count = await queries.run({id: "demo.inventory.count"});
const names = await queries.run({id: "demo.inventory.list", args: {category: "stationery"}});
const product = await queries.run({id: "demo.inventory.detail", args: {sku: "NOTE-01"}});</x-code>

        <p>In global Search, enter <code>demo.inventory</code> to search default providers or <code>query: demo.inventory</code> to search Queries.
        Selecting a Query result opens its invocation Page.</p>

        <h2>Discovered Queries</h2>
        <ul>
            <li x-for="item in state.items"><strong>{{ item.label }}</strong> <code>{{ item.id }}</code> {{ item.description }}</li>
        </ul>

        <h2>Try a Query</h2>
        <p>
            <x-button label="Count in-stock products" command="count"></x-button>
            <x-button label="List stationery" command="list"></x-button>
            <x-button label="Find NOTE-01" command="find"></x-button>
            <x-button label="Look up an unknown SKU" command="findMissing"></x-button>
        </p>
        <x-notice x-if="state.error" type="error" label="Query failed" x-attr:message="state.error"></x-notice>
        <x-code x-if="state.result" language="json" x-prop:value="state.result"></x-code>
        <p>See <x-anchor href="08-commands.js">Commands</x-anchor> for Task-backed execution.</p>
    `,

    state: {items: [], result: "", error: ""},

    controller({queries, state}) {
        let request = 0;
        return {
            load() {
                // Display metadata from the module inventory.
                state.items = queries.list({moduleId: "x-demo", query: "demo.inventory."});
            },
            unload() {
                // Ignore outstanding responses after the Page closes.
                request++;
            },
            async run(id, args) {
                // Render the most recent request's result or error.
                const current = ++request;
                state.result = "";
                state.error = "";
                try {
                    const result = await queries.run({id, args});
                    if (current === request) state.result = JSON.stringify(result, null, 2);
                } catch (error) {
                    if (current === request) state.error = error?.message ?? String(error);
                }
            },
            count() { return this.run("demo.inventory.count"); },
            list() { return this.run("demo.inventory.list", {category: "stationery"}); },
            find() { return this.run("demo.inventory.detail", {sku: "NOTE-01"}); },
            findMissing() { return this.run("demo.inventory.detail", {sku: "UNKNOWN"}); }
        };
    }
};
