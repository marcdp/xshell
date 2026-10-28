export default {
    meta: {
        title: "Page Stack",
        description: "The stack layout opens a child Page over the current one."
    },

    template: `
        <p>The stack layout opens a child Page over the current one.</p>
        <x-anchor href="../02-pages/04-state.js" open="stack">Open Page State in a stack</x-anchor>
        <p>The navigation service owns the stack; the target remains a Page.</p>
        
    `
};
