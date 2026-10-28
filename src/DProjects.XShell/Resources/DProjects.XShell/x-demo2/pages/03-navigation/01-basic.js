
export default {
    meta: {
        title: "Navigation Actions",
        description: "Demonstrates declarative navigation, relative and absolute paths, and controller-driven navigation."
    },

    template: `
        <p>XShell provides declarative navigation through <code>x-anchor</code> and programmatic navigation through the <code>navigation</code> service.</p>

        <h2>Declarative navigation</h2>
        <p>Use <code>x-anchor</code> for ordinary Page links. XShell handles navigation within the active Area.</p>
        <p><x-anchor href="../02-pages/01-basic.js">Open Basic Page</x-anchor></p>
        <p><x-anchor href="../02-pages/04-state.js">Open Page State</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js"&gt;Open Basic Page&lt;/x-anchor&gt;</code></pre>

        <h2>Relative paths</h2>
        <p>Relative paths are resolved from the current Page. Use <code>..</code> to navigate to a sibling Page directory.</p>
        <p><x-anchor href="../02-pages/03-parameters.js">Open Page Parameters</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/03-parameters.js"&gt;Page Parameters&lt;/x-anchor&gt;</code></pre>

        <h2>Absolute paths</h2>
        <p>Absolute navigation paths use the active Area's prefix. The cookbook Area uses <code>/cookbook</code>.</p>
        <p><x-anchor href="/cookbook/hello/Ada">Open Hello Ada</x-anchor></p>
        <p><x-anchor href="/cookbook/hello/Grace">Open Hello Grace</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="/cookbook/hello/Ada"&gt;Hello Ada&lt;/x-anchor&gt;
&lt;x-anchor href="/cookbook/hello/Grace"&gt;Hello Grace&lt;/x-anchor&gt;</code></pre>
        <p>The <code>/hello/{name}</code> route is defined in the cookbook Module configuration and resolves to the Page Parameters example.</p>

        <h2>Programmatic navigation</h2>
        <p>Use the injected <code>navigation</code> service when navigation is triggered by controller logic rather than a direct link.</p>
        <p>
            <x-button label="Open Page State" command="openState"></x-button>
            <x-button label="Open Hello Grace" command="openGrace"></x-button>
        </p>
        <pre x-pre><code>controller({navigation, page}) {
    return {
        openState() {
            navigation.navigate({href:"../02-pages/04-state.js", page, open:"auto"});
        },
        openGrace() {
            navigation.navigate({href:"/cookbook/hello/Grace", page, open:"auto"});
        }
    };
}</code></pre>

        <h2>Choosing an approach</h2>
        <p>Prefer <code>x-anchor</code> for visible navigation links. Use <code>navigation.navigate()</code> when a controller decides where or when to navigate.</p>
        <p>Both approaches use XShell's navigation system and resolve destinations within the configured Area.</p>

        <h2>Related examples</h2>
        <p>
            <x-anchor href="02-areas.js">Areas and Menus</x-anchor> explains navigation contexts.
            <x-anchor href="03-stack.js">Page Stack</x-anchor> demonstrates stacked navigation.
            <x-anchor href="04-embedded.js">Embedded Pages</x-anchor> demonstrates embedded destinations.
        </p>
    `,

    controller({navigation, page}) {
        return {
            openState() {navigation.navigate({href:"../02-pages/04-state.js", page, open:"auto"});},
            openGrace() {navigation.navigate({href:"/cookbook/hello/Grace", page, open:"auto"});}
        };
    }
};
