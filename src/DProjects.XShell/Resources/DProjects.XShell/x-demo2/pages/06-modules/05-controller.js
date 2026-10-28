export default {
    meta: {
        title: "Module Controller",
        description: "Read a module-wide summary prepared during controller startup."
    },

    template: `
        <p>The Module controller starts once for the canonical runtime Module. It prepares a cookbook summary from the effective file inventory.</p>
        <x-button label="Read module summary" command="refresh"></x-button>
        <p>Module: {{ state.label }} ({{ state.id }})</p>
        <p>Started: {{ state.started }}</p>
        <p>Page resources: {{ state.pageCount }}</p>
        <p>Menu source: {{ state.menuSource }}</p>
        <p>This Page reads the Module controller through <code>moduleController</code>. The Area later composes its menu from the same inventory.</p>
    `,

    state: { id: "", label: "", started: false, pageCount: 0, menuSource: "" },

    controller({ moduleController, state }) {
        return {
            load() { this.refresh(); },
            refresh() {
                const summary = moduleController.getCookbookSummary();
                state.id = summary.id;
                state.label = summary.label;
                state.started = summary.started;
                state.pageCount = summary.pageCount;
                state.menuSource = summary.menuSource;
            }
        };
    }
};
