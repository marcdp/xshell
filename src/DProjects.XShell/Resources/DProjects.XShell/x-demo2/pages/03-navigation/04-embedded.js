
export default {
    meta: {
        title: "Embedded Pages",
        description: "Demonstrates embedded navigation, named outlets, and switching embedded Page destinations."
    },

    template: `
        <p>Embedded navigation displays a child Page inside the current Page without replacing the top-level destination. Use <code>open="embed"</code> with a named <code>x-page</code> outlet.</p>

        <h2>Embedded navigation</h2>
        <p>Click a link to load a Page into the outlet below. All three links use the same outlet, so each destination replaces the previous embedded Page.</p>
        <p>
            <x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example">Basic Page</x-anchor> |
            <x-anchor href="../02-pages/04-state.js" open="embed" outlet="example">Page State</x-anchor> |
            <x-anchor href="../02-pages/03-parameters.js?name=Grace&amp;count=7" open="embed" outlet="example">Page Parameters</x-anchor>
        </p>
        <x-card>
            <h3 slot="header">Embedded content</h3>
            <x-page outlet="example"></x-page>
        </x-card>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example"&gt;Basic Page&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/04-state.js" open="embed" outlet="example"&gt;Page State&lt;/x-anchor&gt;
&lt;x-page outlet="example"&gt;&lt;/x-page&gt;</code></pre>

        <h2>Named outlets</h2>
        <p>The <code>outlet</code> property identifies where an embedded Page should appear. The name on the navigation link must match the name on its destination <code>x-page</code>.</p>
        <p>These two outlets are independent. Opening a Page in one does not replace the content of the other.</p>
        <x-datafields columns="2">
            <x-datafield label="First outlet">
                <p><x-anchor href="../02-pages/01-basic.js" open="embed" outlet="first">Load Basic Page</x-anchor></p>
                <x-page outlet="first"></x-page>
            </x-datafield>
            <x-datafield label="Second outlet">
                <p><x-anchor href="../02-pages/04-state.js" open="embed" outlet="second">Load Page State</x-anchor></p>
                <x-page outlet="second"></x-page>
            </x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js" open="embed" outlet="first"&gt;Load first&lt;/x-anchor&gt;
&lt;x-page outlet="first"&gt;&lt;/x-page&gt;

&lt;x-anchor href="../02-pages/04-state.js" open="embed" outlet="second"&gt;Load second&lt;/x-anchor&gt;
&lt;x-page outlet="second"&gt;&lt;/x-page&gt;</code></pre>

        <h2>Embedded versus normal navigation</h2>
        <p>Normal navigation changes the current destination. Embedded navigation keeps the current Page visible and loads the destination into an outlet.</p>
        <p><x-anchor href="../02-pages/01-basic.js">Open Basic Page normally</x-anchor></p>
        <p><x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example">Open Basic Page in the example outlet</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js"&gt;Normal navigation&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example"&gt;Embedded navigation&lt;/x-anchor&gt;</code></pre>

        <h2>When to use embedded Pages</h2>
        <p>Embedded Pages are useful for detail panels, previews, and interfaces where the parent Page remains visible while the user switches between related destinations.</p>
        <p>The embedded destination is still a Page with its own template, state, and lifecycle. The navigation service manages loading it into the selected outlet.</p>
        <p>For other navigation modes, see <x-anchor href="01-basic.js">Navigation Actions</x-anchor> and <x-anchor href="03-stack.js">Page Stack</x-anchor>.</p>
    `
};
