
export const contract = {
    description: "About XShell",
    events: {},
    properties: {},
    methods: {}
};

export default {
    meta: {
        title: "About XShell"
    },
    style: `
        .intro {font-size:1.1em; line-height:1.6; max-width:65em;}
        .features {display:grid; grid-template-columns:repeat(auto-fit, minmax(17em, 1fr)); gap:1em; margin:1.5em 0;}
        .feature {padding:1.25em; border:var(--x-card-border); border-radius:var(--x-card-border-radius); background:var(--x-color-background-alt);}
        .feature h3 {margin:0 0 .5em;}
        .feature p {margin:0; line-height:1.5;}
        .links {display:flex; flex-wrap:wrap; gap:1em; margin-top:1.5em;}
    `,
    template: `
        <p class="intro">XShell is a modular web application framework built around Web Components, declarative templates, and a configurable runtime. It provides the infrastructure for building applications with reusable UI components, navigation, layouts, and integrated services.</p>

        <h2>Features</h2>
        <div class="features">
            <div class="feature">
                <h3>Components</h3>
                <p>Reusable Web Components with contracts, reactive state, and declarative event handling.</p>
            </div>
            <div class="feature">
                <h3>Templates</h3>
                <p>Declarative XTemplates with data binding, conditional rendering, loops, and event handlers.</p>
            </div>
            <div class="feature">
                <h3>Navigation</h3>
                <p>Page navigation with layouts, breadcrumbs, dialogs, and application areas.</p>
            </div>
            <div class="feature">
                <h3>Modules</h3>
                <p>Modular application organization with resource resolution, loaders, and configurable dependencies.</p>
            </div>
            <div class="feature">
                <h3>Data</h3>
                <p>DataSets, schema validation, and reusable data sources for application components.</p>
            </div>
            <div class="feature">
                <h3>Styling</h3>
                <p>CSS custom properties, native light and dark appearance, and customizable component styles.</p>
            </div>
        </div>

        <x-divider></x-divider>

        <h2>Architecture</h2>
        <p>XShell separates application configuration, resource loading, component rendering, state management, and navigation. Applications are assembled from independently defined modules and resources.</p>

        <h2>Project</h2>
        <p>XShell is developed as part of the DProjects ecosystem.</p>

        <div class="links">
            <x-anchor href="https://github.com/marcdp/xshell" target="_blank" rel="noopener noreferrer">GitHub repository</x-anchor>
        </div>
    `,
    controller() {
        return {
            load() {
                // load
            }
        };
    }
};
