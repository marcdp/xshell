
export default {
    meta: {
        title: "Page Stack",
        description: "Demonstrates stacked Page navigation using anchors and the navigation service."
    },

    template: `
        <p>Stack navigation opens a child Page over the current Page, preserving the parent navigation context. XShell manages the stack and its navigation history.</p>

        <h2>Declarative stack navigation</h2>
        <p>Use <code>open="stack"</code> on an <code>x-anchor</code> to open another Page in a stack.</p>
        <p><x-anchor href="../02-pages/04-state.js" open="stack">Open Page State in a stack</x-anchor></p>
        <p><x-anchor href="../02-pages/03-parameters.js?name=Grace&amp;count=7" open="stack">Open Page Parameters in a stack</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/04-state.js" open="stack"&gt;Open Page State&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/03-parameters.js?name=Grace&amp;count=7" open="stack"&gt;Open Page Parameters&lt;/x-anchor&gt;</code></pre>

        <h2>Programmatic stack navigation</h2>
        <p>Use <code>navigation.navigate()</code> with <code>open:"stack"</code> when the destination is opened by controller logic.</p>
        <p>
            <x-button label="Open Page State" command="openState"></x-button>
            <x-button label="Open Page Parameters" command="openParameters"></x-button>
        </p>
        <pre x-pre><code>controller({navigation, page}) {
    return {
        openState() {
            navigation.navigate({href:"../02-pages/04-state.js", page, open:"stack"});
        }
    };
}</code></pre>

        <h2>Stack versus normal navigation</h2>
        <p>Normal navigation changes the current destination. Stack navigation opens a child destination while retaining its parent context.</p>
        <p><x-anchor href="../02-pages/01-basic.js">Open Basic Page normally</x-anchor></p>
        <p><x-anchor href="../02-pages/01-basic.js" open="stack">Open Basic Page in a stack</x-anchor></p>
        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js"&gt;Normal navigation&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/01-basic.js" open="stack"&gt;Stack navigation&lt;/x-anchor&gt;</code></pre>

        <h2>Returning to the parent</h2>
        <p>After opening a stacked Page, use the stack's navigation controls to return to its parent. The stack is managed by XShell; the child Page does not need special code.</p>

        <h2>Choosing a navigation mode</h2>
        <p>Use normal navigation when moving to another destination. Use stack navigation when opening a related Page while preserving the parent context.</p>
        <p>For other presentation modes, see <x-anchor href="04-embedded.js">Embedded Pages</x-anchor> and <x-anchor href="01-basic.js">Navigation Actions</x-anchor>.</p>
    `,

    controller({navigation, page}) {
        return {
            openState() {navigation.navigate({href:"../02-pages/04-state.js", page, open:"stack"});},
            openParameters() {navigation.navigate({href:"../02-pages/03-parameters.js?name=Grace&count=7", page, open:"stack"});}
        };
    }
};
