
export default {
    meta: {
        title: "Page State",
        description: "Demonstrates private Page state, controller mutations, derived values, and conditional behavior."
    },

    template: `
        <p>A Page can define private reactive <code>state</code>. Changes to state automatically update the parts of the template that depend on it.</p>

        <h2>Declaring and observing state</h2>
        <p>The initial object belongs to this Page instance. These controls make changes observable while the greeting shows the resulting reactive update.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Name" x-model="state.name"></x-datafield>
            <x-datafield type="number" label="Age" min="0" max="120" x-model="state.age"></x-datafield>
        </x-datafields>
        <p>Hello <strong>{{ state.name }}</strong>! You are {{ state.age }} years old.</p>
        <pre x-pre><code>state: {name:"Ada", age:36}</code></pre>
        <p>The controls use <code>x-model</code> so user edits update the same state object. The X Template syntax itself is covered in <x-anchor href="../07-templates/01-basics.js">Template Basics</x-anchor>.</p>

        <h2>Controller mutations</h2>
        <p>Controller commands receive the reactive <code>state</code> object and can update it directly. The bound controls and rendered text reflect the same mutations.</p>
        <p>
            <x-button label="Set Ada" command="setAda"></x-button>
            <x-button label="Set Grace" command="setGrace"></x-button>
            <x-button label="Increase age" command="increaseAge"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <p>Current name: {{ state.name }}</p>
        <pre x-pre><code>controller({state}) {
    return {
        setGrace() {state.name = "Grace";},
        increaseAge() {state.age++;},
        reset() {
            state.name = "Ada";
            state.age = 36;
            state.showDetails = false;
        }
    };
}</code></pre>

        <h2>Conditional rendering</h2>
        <p>Use <code>x-if</code> and <code>x-else</code> to display content based on reactive state.</p>
        <x-datafields columns="1">
            <x-datafield type="checkbox" label="Details" label-secondary="Show additional information" x-model="state.showDetails"></x-datafield>
        </x-datafields>
        <x-notice x-if="state.showDetails" type="info" label="Details visible" message="This content is displayed because the setting is enabled."></x-notice>
        <p x-else>Additional information is hidden.</p>
        <pre x-pre><code>&lt;x-notice x-if="state.showDetails" type="info" label="Visible"&gt;&lt;/x-notice&gt;
&lt;p x-else&gt;Details are hidden.&lt;/p&gt;</code></pre>

        <h2>Derived values</h2>
        <p>Expressions can combine state properties without storing additional values.</p>
        <p>Profile: <strong>{{ state.name }} ({{ state.age >= 18 ? "Adult" : "Minor" }})</strong></p>
        <pre x-pre><code>&lt;p&gt;{{ state.age >= 18 ? "Adult" : "Minor" }}&lt;/p&gt;</code></pre>

        <h2>Current state</h2>
        <p>All examples on this Page share the same private state object.</p>
        <x-json x-prop:value="state.snapshot" indent="2"></x-json>
        <p>State is private implementation data. Public Page inputs are properties declared by the Page contract; they are not automatically the same abstraction.</p>

        <h2>Technical reference</h2>
        <p>See <x-anchor x-attr:href="state.docsState">State</x-anchor> for the canonical property/state boundary, engine selection, and notification behavior.</p>
    `,

    state: {
        name: "Ada",
        age: 36,
        showDetails: false,
        snapshot: {name:"Ada", age:36, showDetails:false},
        docsState: ""
    },

    controller({config, state, events}) {
        const refresh = () => {
            state.snapshot = {name:state.name, age:state.age, showDetails:state.showDetails};
        };
        return {
            load() {
                events.on(state, ["change:name", "change:age", "change:showDetails"], refresh);
                state.docsState = config.modules["xshell-docs"].assets.path +
                    "/pages/20-components/30-state.md";
            },
            setAda() {state.name="Ada";},
            setGrace() {state.name="Grace";},
            increaseAge() {state.age++;},
            reset() {
                state.name="Ada";
                state.age=36;
                state.showDetails=false;
            }
        };
    }
};
