export default {
    meta: {
        title: "Transformers",
        description: "Pipelines format a value from left to right."
    },

    template: `
        <p>Pipelines format a value from left to right.</p>
        <label>Name <input x-model="state.name"></label>
        <p>Trimmed: {{ state.name | trim }}</p>
        <p>Uppercase: {{ state.name | trim | upper }}</p>
        <p>Slug: {{ state.name | slug }}</p>
        
    `,

    state: {
        name: "  Ada Lovelace  "
    }
};
