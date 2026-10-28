export default {
    template: `
        <h1>Buttons</h1>
        <p>Buttons expose labels, icons, and controller commands.</p>
        <x-button label="Default"></x-button>
        <x-button class="submit" label="Submit"></x-button>
        <x-button icon="x-add" label="Add one" command="increment"></x-button>
        <p>Clicked: {{ state.count }}</p>
        <pre x-pre><code>&lt;x-button label="Add one" command="increment"&gt;&lt;/x-button&gt;</code></pre>
        
    `,
    state: { count: 0 },
    controller({ state }) { return { increment() { state.count += 1; } }; }
};
