export default {
    template: `
        <h1>Static Dataset</h1>
        <p>A static dataset uses an inline resource locator and needs no file.</p>
        <x-button label="Load statuses" command="loadStatuses"></x-button>
        <p>Rows: {{ state.count }}</p>
        
    `,
    state: { count: 0 },
    controller({ loader, state }) {
        return { async loadStatuses() { const dataset = await loader.load("dataset:static:A=Active|I=Inactive"); state.count = dataset.tables[0].rows.length; } };
    }
};
