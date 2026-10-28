export default {
    template: `
        <h1>Page Lifecycle</h1>
        <p>A Page controller can update state in its load and unload hooks.</p>
        <p>Status: {{ state.status }}</p>
        <p>Navigate away and return to run load again.</p>
        
    `,
    state: { status: "created" },
    controller({ state }) {
        return {
            load() { state.status = "loaded"; },
            unload() { state.status = "unloaded"; }
        };
    }
};
