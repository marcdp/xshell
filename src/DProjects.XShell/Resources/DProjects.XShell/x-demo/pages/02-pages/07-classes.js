
export default {
    meta: {
        title: "Page Classes",
        description: "Demonstrates applying CSS classes to the page layout container.",
        classes: ["fill"]
    },

    template: `

        <p>
            Pages can declare CSS classes through
            <code>meta.classes</code>.
        </p>

        <pre x-pre><code>meta: {
    classes: ["fill"]
}</code></pre>

        <p>
            The active layout applies the declared classes
            to its page container, rather than to the
            Page content itself.
        </p>

        <p>
            This Page uses the <code>fill</code> class.
        </p>

    `
};
