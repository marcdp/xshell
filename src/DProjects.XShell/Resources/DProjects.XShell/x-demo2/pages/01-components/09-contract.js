export default {
    meta: { title: "Component Contract", description: "The exported contract defines public properties, methods, and slots; count is private state." },
    template: `
        <p>The exported contract defines public properties, methods, and slots; count is private state.</p>
        <x-demo2-counter label="Clicks"><small slot="hint">The count belongs to the component.</small></x-demo2-counter>
        <x-button label="Reset component" command="resetCounter"></x-button>
        <p>Source: components/x-demo2-counter.js</p>
        
    `,
    controller({ page }) {
        return { resetCounter() { page.host.querySelector("x-demo2-counter")?.reset(); } };
    }
};
