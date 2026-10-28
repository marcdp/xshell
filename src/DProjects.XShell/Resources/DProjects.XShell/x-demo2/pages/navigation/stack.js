export default {
    template: `
        <h1>Page Stack</h1>
        <p>The stack layout opens a child Page over the current one.</p>
        <x-anchor href="../pages/state.js" open="stack">Open Page State in a stack</x-anchor>
        <p>The navigation service owns the stack; the target remains a Page.</p>
        
    `
};
