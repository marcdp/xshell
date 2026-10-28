
export default {
    meta: {
        title: "Anchors",
        description: "Demonstrates navigation links using the x-anchor component."
    },

    template: `
        <p>
            The <code>x-anchor</code> component creates links integrated
            with XShell Navigation. Unlike a regular HTML anchor, it supports
            Page context, query parameters, and different opening modes.
        </p>

        <h2>Basic navigation</h2>

        <p>
            Navigate to another Page using a relative URL.
        </p>

        <p>
            <x-anchor href="../02-pages/01-basic.js">
                Open Basic Page
            </x-anchor>
        </p>

        <pre x-pre><code>&lt;x-anchor href="../02-pages/01-basic.js"&gt;
    Open Basic Page
&lt;/x-anchor&gt;</code></pre>

        <h2>Absolute navigation</h2>

        <p>
            Navigate using an absolute path within the cookbook Area.
        </p>

        <p>
            <x-anchor href="/cookbook/pages/state">
                Open Page State
            </x-anchor>
        </p>

        <pre x-pre><code>&lt;x-anchor href="/cookbook/pages/state"&gt;
    Open Page State
&lt;/x-anchor&gt;</code></pre>

        <h2>Query parameters</h2>

        <p>
            Use the <code>query</code> property to pass parameters
            to another Page.
        </p>

        <p>
            <x-anchor
                href="../02-pages/03-parameters.js"
                x-prop:query="state.query">
                Open Page with parameters
            </x-anchor>
        </p>

        <pre x-pre><code>&lt;x-anchor
    href="../02-pages/03-parameters.js"
    x-prop:query="state.query"&gt;
    Open Page with parameters
&lt;/x-anchor&gt;</code></pre>

        <h2>Opening modes</h2>

        <p>
            The <code>open</code> property controls how the destination
            Page is opened.
        </p>

        <ul>
            <li>
                <x-anchor
                    href="../02-pages/01-basic.js"
                    open="auto">
                    Auto
                </x-anchor>
            </li>
            <li>
                <x-anchor
                    href="../02-pages/01-basic.js"
                    open="top">
                    Top
                </x-anchor>
            </li>
            <li>
                <x-anchor
                    href="../02-pages/01-basic.js"
                    open="stack">
                    Stack
                </x-anchor>
            </li>
            <li>
                <x-anchor
                    href="../02-pages/01-basic.js"
                    open="dialog"
                    title="Basic Page">
                    Dialog
                </x-anchor>
            </li>
        </ul>

        <pre x-pre><code>&lt;x-anchor
    href="../02-pages/01-basic.js"
    open="dialog"
    title="Basic Page"&gt;
    Open as dialog
&lt;/x-anchor&gt;</code></pre>

        <h2>Appearance</h2>

        <p>
            The component supports CSS classes for different
            link presentations.
        </p>

        <p>
            <x-anchor href="../02-pages/01-basic.js">
                Default anchor
            </x-anchor>
        </p>

        <p>
            <x-anchor
                class="plain"
                href="../02-pages/01-basic.js">
                Plain anchor
            </x-anchor>
        </p>

        <p>
            <x-anchor
                class="block"
                href="../02-pages/01-basic.js">
                Block anchor
            </x-anchor>
        </p>

        <h2>Disabled links</h2>

        <p>
            A disabled anchor cannot be activated.
        </p>

        <p>
            <x-anchor
                href="../02-pages/01-basic.js"
                disabled>
                Disabled anchor
            </x-anchor>
        </p>

        <pre x-pre><code>&lt;x-anchor
    href="../02-pages/01-basic.js"
    disabled&gt;
    Disabled anchor
&lt;/x-anchor&gt;</code></pre>

        <h2>Tooltips</h2>

        <p>
            Use the <code>tooltip</code> property to provide
            additional information.
        </p>

        <p>
            <x-anchor
                href="../02-pages/01-basic.js"
                tooltip="Navigate to the Basic Page example">
                Hover over this link
            </x-anchor>
        </p>

        <h2>External links</h2>

        <p>
            External URLs can be opened using standard browser behavior.
        </p>

        <p>
            <x-anchor
                href="https://developer.mozilla.org/"
                target="_blank"
                rel="noopener noreferrer">
                MDN Web Docs
            </x-anchor>
        </p>

        <h2>History replacement</h2>

        <p>
            Use <code>replace</code> to replace the current
            browser history entry instead of adding a new one.
        </p>

        <p>
            <x-anchor
                href="../02-pages/01-basic.js"
                replace>
                Navigate and replace history
            </x-anchor>
        </p>
    `,

    state: {
        query: {
            name: "Ada",
            count: 7
        }
    }
};
