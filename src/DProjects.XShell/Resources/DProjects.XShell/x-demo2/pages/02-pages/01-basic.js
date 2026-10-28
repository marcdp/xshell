export default {
    meta: {
        title: "Basic Page",
        description: "A Page is a default-exported implementation with a template."
    },

    template: `
        <p>A Page is a default-exported implementation with a template.</p>
        <p>This Page has no state or controller because it needs neither.</p>
        <pre x-pre><code>export default { template: "&lt;p&gt;Hello&lt;/p&gt;" };</code></pre>
        
    `
};
