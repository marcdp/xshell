
export default {
    meta: {
        title: "URL Rewriting Test",
        description: "Manually tests HTML URL rewriting in XShell."
    },

    template: `
        <h2>Navigation URLs</h2>
        <p>Test standard HTML links and compare them with XShell navigation links.</p>

        <p>
            <a id="test-relative" href="../02-pages/04-state.js">Relative HTML link</a>
        </p>
        <p>
            <a id="test-root" href="/pages/02-pages/04-state.js">Module-root HTML link</a>
        </p>
        <p>
            <a id="test-fragment" href="#section">Fragment link</a>
        </p>
        <p>
            <a id="test-external" href="https://example.com/">External link</a>
        </p>

        <h2>Virtual navigation</h2>
        <p>
            <x-anchor id="test-x-anchor" href="../02-pages/04-state.js">
                XShell navigation link
            </x-anchor>
        </p>

        <h2>Resource URLs</h2>
        <p>The following image deliberately references a missing file. Inspect its rewritten src.</p>
        <img id="test-image" src="./test-image.png" alt="URL rewriting test">

        <h2>Form navigation</h2>
        <form id="test-form" action="../02-pages/04-state.js" method="get">
            <p>Inspect the form action without submitting it.</p>
        </form>

        <h2>Results</h2>
        <p>Open browser DevTools and inspect the attributes of the elements above.</p>

        <div id="section">Fragment target</div>
    `
};
