export default {
    template: `
        <h1>Module Dataset</h1>
        <p>A module dataset resolves from this module’s datasets directory.</p>
        <x-button label="Load statuses" command="loadStatuses"></x-button>
        <ul><li x-for="row in state.rows">{{ row.code }} — {{ row.label }}</li></ul>
        
    `,
    state: { rows: [] },
    controller({ loader, state }) {
        return { async loadStatuses() { const dataset = await loader.load("dataset:x-demo2:statuses"); state.rows = dataset.tables[0].rows; } };
    }
};
