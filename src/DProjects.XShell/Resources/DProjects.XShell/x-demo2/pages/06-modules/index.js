export default {
    meta: {
        title: "Modules",
        description: "Inspect the resolved module and its resource references."
    },

    template: `
        <p>Inspect the resolved module and its resource references.</p>
        <ul><li><x-anchor href="01-definition.js">Module Definition</x-anchor></li><li><x-anchor href="02-references.js">Module References</x-anchor></li><li><x-anchor href="03-dependencies.js">Declarative Dependencies</x-anchor></li><li><x-anchor href="04-resources.js">Module Resources</x-anchor></li><li><x-anchor href="05-controller.js">Module Controller</x-anchor></li><li><x-anchor href="06-menus.js">Menu Contributions</x-anchor></li></ul>
    `
};
