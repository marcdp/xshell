export default {
    template: `
        <h1>Embedded Pages</h1>
        <p>A Page can host another Page without changing the top-level destination.</p>
        <x-anchor href="../pages/basic.js" open="embed" outlet="example">Load Basic Page here</x-anchor>
            <x-page outlet="example"></x-page>
            <pre x-pre><code>&lt;x-anchor href="../pages/basic.js" open="embed" outlet="example"&gt;Load&lt;/x-anchor&gt;
        &lt;x-page outlet="example"&gt;&lt;/x-page&gt;</code></pre>
        
    `
};
