export default {
    template: `
        <h1>Editors</h1>
        <p>Data fields select an editor from their type.</p>
        <x-datafield type="javascript" label="JavaScript" x-model="state.code"></x-datafield>
        <x-datafield type="markdown" label="Markdown" x-model="state.markdown"></x-datafield>
        <p>Current code:</p><pre>{{ state.code }}</pre>
        
    `,
    state: { code: "const answer = 42;", markdown: "**Hello**" }
};
