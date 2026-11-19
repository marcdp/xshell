
export default {
    contract: {
        description: "About XShell",
        events: {},
        properties: {},
        methods: {}
    },

    meta: {
        title: "About XShell"
    },

    style: `
        .about {max-width:42em; line-height:1.6;}
        .about h2 {margin-top:1.5em;}
    `,

    template: `
        <div class="about">
            <p>XShell is a modular framework for building web applications using Web Components and declarative templates.</p>

            <h2>Core ideas</h2>
            <ul>
                <li><strong>Modularity:</strong> Build applications from independent, reusable modules.</li>
                <li><strong>Declarative UI:</strong> Create interfaces with components, templates, and reactive state.</li>
                <li><strong>Integrated runtime:</strong> Navigation, resource loading, and services work together.</li>
            </ul>

            <h2>Project</h2>
            <p>XShell is part of the DProjects ecosystem.</p>
            <p><x-anchor href="https://github.com/marcdp/xshell">GitHub repository</x-anchor></p>
        </div>
    `
};
