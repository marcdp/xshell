export default {
    template: `
        <h1>Module Controller</h1>
        <p>The module controller starts before Area menus are composed.</p>
        <p>Controller label: {{ state.label }}</p>
        <p>Started: {{ state.started }}</p>
        
    `,
    state: { label: "", started: false },
    controller({ modules, state }) {
        return {
            load() {
                const controller = modules.getModuleById("x-demo2").controller;
                state.label = controller.label;
                state.started = controller.started;
            }
        };
    }
};
