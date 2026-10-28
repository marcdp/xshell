export default {
    meta: { title: "Embedded Pages", description: "A Page can host another Page without changing the top-level destination." },
    template: `
        <p>A Page can host another Page without changing the top-level destination.</p>
        <x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example">Load Basic Page here</x-anchor>
            <x-page outlet="example"></x-page>
            <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js" open="embed" outlet="example"&gt;Load&lt;/x-anchor&gt;
        &lt;x-page outlet="example"&gt;&lt;/x-page&gt;</code></pre>
        
    `
};
