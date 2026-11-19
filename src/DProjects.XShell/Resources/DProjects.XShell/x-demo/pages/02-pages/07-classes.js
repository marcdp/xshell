
export default {
    meta: {
        title: "Page Classes",
        description: "Demonstrates applying CSS classes to the page layout container.",
        classes: ["size-full"]
    },
    style: `
        
    `,
    template: `
        <p>
            Pages can declare CSS classes through
            <code>meta.classes</code>.
        </p>

        <pre x-pre><code>meta: {
    classes: ["size-full"]
}</code></pre>

        <p>
            The active layout applies the declared classes
            to its page container, rather than to the
            Page content itself.
        </p>

        <p>
            This Page uses the <code>size-full</code> class.
        </p>

    `
};
