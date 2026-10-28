export default {
    template: `
        <h1>XShell Cookbook</h1>
        <p>Choose one focused, executable example. Each file can be read on its own.</p>
        <ul><li><x-anchor href="components/index.js">Components</x-anchor> — Core UI elements and composition.</li><li><x-anchor href="pages/index.js">Pages</x-anchor> — Page definitions, public properties, private state, and lifecycle.</li><li><x-anchor href="navigation/index.js">Navigation</x-anchor> — Move between Pages and inspect the active Area.</li><li><x-anchor href="dialogs/index.js">Dialogs</x-anchor> — Use XShell dialog services and inspect their results.</li><li><x-anchor href="filesystem/index.js">Filesystem</x-anchor> — Browser selection and an optional hosted file share.</li><li><x-anchor href="templates/index.js">X Templates</x-anchor> — Bindings and directives in the optional X Template render engine.</li><li><x-anchor href="modules/index.js">Modules</x-anchor> — Inspect the resolved module and its resource references.</li><li><x-anchor href="advanced/index.js">Advanced Runtime</x-anchor> — Inspect services, events, engines, loading, and datasets.</li><li><x-anchor href="ai/index.js">AI</x-anchor> — A local simulated chat; no AI credentials required.</li></ul>
        <p><x-anchor href="/pages/index.js">Read the XShell documentation</x-anchor></p>
    `
};
