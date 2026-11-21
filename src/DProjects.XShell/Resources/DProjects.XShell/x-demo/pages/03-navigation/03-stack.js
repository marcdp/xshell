
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
        <x-code language="html" x-pre>&lt;x-anchor href="../02-pages/04-state.js" open="stack"&gt;Open Page State&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/03-parameters.js?name=Grace&amp;count=7" open="stack"&gt;Open Page Parameters&lt;/x-anchor&gt;</x-code>

        <h2>Programmatic stack navigation</h2>
        <p>Use <code>navigation.navigate()</code> with <code>open:"stack"</code> when the destination is opened by controller logic.</p>
        <p>
            <x-button label="Open Page State" command="openState"></x-button>
            <x-button label="Open Page Parameters" command="openParameters"></x-button>
        </p>
        <x-code language="javascript" x-pre>controller({navigation, page}) {
    return {
        openState() {
            navigation.navigate({href:"../02-pages/04-state.js", page, open:"stack"});
        }
    };
}</x-code>

        <h2>Stack sizes</h2>
        <p>A Page can set its preferred size in <code>meta.classes</code>. The opener can override it by passing a size in <code>classes</code>.</p>
        <p>
            <x-button label="size-compact" command="openSized" data-size="size-compact"></x-button>
            <x-button label="size-narrow" command="openSized" data-size="size-narrow"></x-button>
            <x-button label="size-medium" command="openSized" data-size="size-medium"></x-button>
            <x-button label="size-wide" command="openSized" data-size="size-wide"></x-button>
            <x-button label="size-full" command="openSized" data-size="size-full"></x-button>
        </p>
        <p><x-anchor href="../02-pages/04-state.js" open="stack" x-prop:classes="state.compactClasses">Open a compact stack with an anchor</x-anchor></p>
        <x-code language="html" x-pre>&lt;x-anchor href="../02-pages/04-state.js" open="stack" x-prop:classes="state.compactClasses"&gt;Open compact stack&lt;/x-anchor&gt;</x-code>

        <h2>Stack versus normal navigation</h2>
        <p>Normal navigation changes the current destination. Stack navigation opens a child destination while retaining its parent context.</p>
        <p><x-anchor href="../02-pages/01-basic.js">Open Basic Page normally</x-anchor></p>
        <p><x-anchor href="../02-pages/01-basic.js" open="stack">Open Basic Page in a stack</x-anchor></p>
        <x-code language="html" x-pre>&lt;x-anchor href="../02-pages/01-basic.js"&gt;Normal navigation&lt;/x-anchor&gt;
&lt;x-anchor href="../02-pages/01-basic.js" open="stack"&gt;Stack navigation&lt;/x-anchor&gt;</x-code>

        <h2>Returning to the parent</h2>
        <p>After opening a stacked Page, use the stack's navigation controls to return to its parent. The stack is managed by XShell; the child Page does not need special code.</p>

        <h2>Choosing a navigation mode</h2>
        <p>Use normal navigation when moving to another destination. Use stack navigation when opening a related Page while preserving the parent context.</p>
    `,

    state: {
        compactClasses: ["size-compact"]
    },

    controller({navigation, page}) {
        return {
            openState() {navigation.navigate({href:"../02-pages/04-state.js", page, open:"stack"});},
            openParameters() {navigation.navigate({href:"../02-pages/03-parameters.js?name=Grace&count=7", page, open:"stack"});},
            openSized(data) {
                // Open the same Page at the size selected by the button.
                navigation.navigate({href:"../02-pages/04-state.js", page, open:"stack", classes:[data.size]});
            }
        };
    }
};
