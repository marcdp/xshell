export default {
    meta: { title: "XShell Cookbook", description: "Choose one focused, executable example. Each file can be read on its own." },
    template: `
        <p>Choose one focused, executable example. Each file can be read on its own.</p>
        <ul><li><x-anchor href="01-components/index.js">Components</x-anchor> — Core UI elements and composition.</li><li><x-anchor href="02-pages/index.js">Pages</x-anchor> — Page definitions, public properties, private state, and lifecycle.</li><li><x-anchor href="03-navigation/index.js">Navigation</x-anchor> — Move between Pages and inspect the active Area.</li><li><x-anchor href="04-dialogs/index.js">Dialogs</x-anchor> — Use XShell dialog services and inspect their results.</li><li><x-anchor href="05-filesystem/index.js">Filesystem</x-anchor> — Browser selection and an optional hosted file share.</li><li><x-anchor href="06-modules/index.js">Modules</x-anchor> — Inspect the resolved module and its resource references.</li><li><x-anchor href="07-templates/index.js">X Templates</x-anchor> — Bindings and directives in the optional X Template render engine.</li><li><x-anchor href="08-ai/index.js">AI</x-anchor> — A local simulated chat; no AI credentials required.</li><li><x-anchor href="90-advanced/index.js">Advanced Runtime</x-anchor> — Inspect services, events, engines, loading, and datasets.</li></ul>
    `
};
