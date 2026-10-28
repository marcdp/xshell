
export default {
    meta: {
        title: "Basic Page",
        description: "Demonstrates the structure of a minimal JavaScript Page in XShell."
    },

    template: `
        <p>A Page defines the content displayed by XShell. A JavaScript Page exports a default object containing its implementation.</p>

        <h2>Minimal Page</h2>
        <p>The simplest Page needs only a <code>template</code>. It does not require state or a controller.</p>
        <pre x-pre><code>export default {
    template: &#96;
        &lt;p&gt;Hello world!&lt;/p&gt;
    &#96;
};</code></pre>
        <p>Result:</p>
        <p>Hello world!</p>

        <h2>Page metadata</h2>
        <p>Use <code>meta</code> to describe the Page. The <code>title</code> and <code>description</code> provide metadata without adding logic to the implementation.</p>
        <pre x-pre><code>export default {
    meta: {
        title: "Hello",
        description: "A simple XShell Page."
    },

    template: &#96;
        &lt;p&gt;Hello world!&lt;/p&gt;
    &#96;
};</code></pre>

        <h2>Optional features</h2>
        <p>Pages can also define reactive <code>state</code> and a <code>controller</code> when they need interactive behavior.</p>
        <p>These are optional. A static Page should remain simple.</p>

        <h2>Next examples</h2>
        <p>
            <x-anchor href="02-html-page.html">HTML Page</x-anchor> demonstrates another Page format.
            <x-anchor href="04-state.js">Page State</x-anchor> demonstrates reactive behavior.
        </p>
    `
};
