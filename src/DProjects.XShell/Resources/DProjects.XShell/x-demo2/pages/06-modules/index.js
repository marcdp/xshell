

export default {
    meta: {
        title: "Modules",
        description: "Learn how XShell Modules organize configuration, resources, controllers, and navigation."
    },

    template: `
        <p>A Module is a named unit of an XShell application. It groups configuration and resources such as Pages, Components, icons, styles, and DataSets. A Module can also provide a controller for module-wide behavior.</p>

        <h2>Module structure</h2>
        <p>The <code>x-demo2</code> Module used by this cookbook has the following structure:</p>
        <pre x-pre><code>x-demo2/
├── module.jsonc
├── module.js
├── pages/
│   └── 06-modules/
├── datasets/
│   └── statuses.json
└── ...</code></pre>
        <p><code>module.jsonc</code> defines configuration. <code>module.js</code> is an optional controller. Other files provide resources that Pages and Components can load.</p>

        <h2>How Modules work</h2>
        <pre x-pre><code>Module definition (module.jsonc)
    |
    v
Configuration bootstrap
    |-- Resolve Module references
    |-- Build resource inventories
    |-- Generate resource mappings
    v
Runtime Module
    |-- Optional module.js controller
    |-- Resources available through Resolver / Loader
    +-- Navigation contributions used by Areas</code></pre>

        <h2>Modules and Areas</h2>
        <p>Modules provide resources and configuration. Areas determine which Modules participate in a navigation context.</p>
        <p>The cookbook Area includes <code>x-demo2</code>, while the application also references Modules such as <code>x</code> and <code>x-filesystem</code> to make their resources available.</p>
        <p>A referenced Module does not automatically appear in the current Area's navigation menu.</p>

        <x-page-index></x-page-index>        
    `
};
