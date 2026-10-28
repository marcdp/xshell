
export default {
    meta: {
        title: "Advanced Templates",
        description: "Demonstrates derived expressions, structured bindings, render controls, and recursive rendering."
    },

    style: `
        .demo-highlight {font-weight:bold; color:var(--x-color-primary);}
        .demo-box {padding:.75rem; margin:.5rem 0; border:1px solid var(--x-color-border); border-radius:.375rem;}
    `,

    template: `
        <p>X Templates support expressions and directives beyond simple interpolation. These features help build more complex interfaces without manually updating DOM elements.</p>

        <h2>Derived expressions</h2>
        <p>Combine state values directly in an expression without storing a duplicate derived value.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="First name" x-model="state.first"></x-datafield>
            <x-datafield type="text" label="Last name" x-model="state.last"></x-datafield>
        </x-datafields>
        <p>Full name: <strong>{{ state.first + " " + state.last }}</strong></p>
        <pre x-pre><code>{{ state.first + " " + state.last }}</code></pre>

        <h2>Conditional expressions</h2>
        <p>Use the conditional operator to choose a value without creating separate elements.</p>
        <x-datafield type="checkbox" label="Active" x-model="state.active"></x-datafield>
        <p>Status: <strong>{{ state.active ? "Active" : "Inactive" }}</strong></p>
        <pre x-pre><code>{{ state.active ? "Active" : "Inactive" }}</code></pre>
        <p>Use <code>x-if</code> when entire elements should be conditionally rendered. Use conditional expressions when only a value changes.</p>

        <h2>Null handling</h2>
        <p>The nullish coalescing operator <code>??</code> provides a fallback for a null value without treating other values, such as zero or false, as missing.</p>
        <p>Optional nickname: <strong>{{ state.nickname ?? "Not provided" }}</strong></p>
        <p>
            <x-button label="Set nickname" command="setNickname"></x-button>
            <x-button label="Clear nickname" command="clearNickname"></x-button>
        </p>
        <pre x-pre><code>{{ state.nickname ?? "Not provided" }}</code></pre>

        <h2>Conditional classes</h2>
        <p>Use <code>x-class:name</code> to add or remove a CSS class according to state.</p>
        <x-datafield type="checkbox" label="Highlight" x-model="state.highlighted"></x-datafield>
        <p x-class:demo-highlight="state.highlighted">This text is highlighted when the checkbox is selected.</p>
        <pre x-pre><code>&lt;p x-class:demo-highlight="state.highlighted"&gt;Highlighted text&lt;/p&gt;</code></pre>

        <h2>Whole-object bindings</h2>
        <p>Use <code>x-attr</code> to apply an object of HTML attributes and <code>x-style</code> to apply an object of CSS properties.</p>
        <div class="demo-box" x-attr="state.attributes" x-style="state.styles">
            This element receives its tooltip and background color from objects.
        </div>
        <pre x-pre><code>&lt;div x-attr="state.attributes" x-style="state.styles"&gt;Styled content&lt;/div&gt;

state: {
    attributes: {title:"Bound tooltip"},
    styles: {"background-color":"#e8f0fe"}
}</code></pre>

        <h2>Render once</h2>
        <p>The <code>x-once</code> directive preserves an element's initial rendered content rather than updating it when its dependencies change.</p>
        <x-datafield type="text" label="Value" x-model="state.onceValue"></x-datafield>
        <p>Reactive: <strong>{{ state.onceValue }}</strong></p>
        <p x-once>Rendered once: <strong>{{ state.onceValue }}</strong></p>
        <pre x-pre><code>&lt;p&gt;Reactive: {{ state.onceValue }}&lt;/p&gt;
&lt;p x-once&gt;Rendered once: {{ state.onceValue }}&lt;/p&gt;</code></pre>

        <h2>Raw template content</h2>
        <p>Use <code>x-pre</code> when template syntax should be displayed literally rather than evaluated.</p>
        <pre x-pre><code>{{ state.first }} {{ state.last }}</code></pre>
        <p>This is particularly useful for displaying source-code examples inside documentation Pages.</p>

        <h2>Recursive rendering</h2>
        <p>The <code>x-recursive</code> directive renders hierarchical data. The <code>x-recursive-wrapper</code> property specifies the element used to wrap nested children.</p>
        <ul>
            <li x-recursive="item in state.tree" x-key="id" x-recursive-wrapper="ul">{{ item.label }}</li>
        </ul>
        <pre x-pre><code>&lt;ul&gt;
    &lt;li x-recursive="item in state.tree" x-key="id" x-recursive-wrapper="ul"&gt;
        {{ item.label }}
    &lt;/li&gt;
&lt;/ul&gt;</code></pre>

        <h2>Choosing an approach</h2>
        <p>Use expressions for small derived values, <code>x-class:</code> for conditional CSS classes, object bindings for grouped attributes or styles, and <code>x-recursive</code> for hierarchical collections.</p>
        <p>Keep complex application logic in the Page controller. X Template expressions are a restricted language and do not support arbitrary JavaScript function calls or object methods.</p>
        <p>For foundational examples, revisit <x-anchor href="01-basics.js">Template Basics</x-anchor> or <x-anchor href="07-transformers.js">Transformers</x-anchor>.</p>
    `,

    state: {
        first: "Ada",
        last: "Lovelace",
        active: true,
        nickname: null,
        highlighted: false,
        attributes: {title:"This tooltip is bound through x-attr."},
        styles: {"background-color":"#e8f0fe"},
        onceValue: "Initial value",
        tree: [
            {
                id:1, label:"Documents", children:[
                    {id:2, label:"Reports", children:[
                        {id:3, label:"Annual report"}
                    ]},
                    {id:4, label:"Notes"}
                ]
            },
            {
                id:5, label:"Projects", children:[
                    {id:6, label:"Demo project"}
                ]
            }
        ]
    },

    controller({state}) {
        return {
            setNickname() {state.nickname = "Countess of Lovelace";},
            clearNickname() {state.nickname = null;}
        };
    }
};
