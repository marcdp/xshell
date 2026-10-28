
export default {
    meta: {
        title: "Path Resolution",
        description: "Demonstrates how Areas resolve Page resources and friendly navigation paths."
    },

    template: `
        <p>XShell separates friendly navigation paths from the canonical hrefs used to identify Page resources. The <code>areas</code> service resolves between these representations within an Area.</p>

        <h2>Current Page</h2>
        <p>The current Page provides a <code>src</code> identifying its source. XShell uses this value to determine the Area and find the corresponding menu item.</p>
        <x-datafields columns="2">
            <x-datafield label="Page source">{{ state.src }}</x-datafield>
            <x-datafield label="Area ID">{{ state.areaId }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const areaId = areas.resolveAreaId(page.src);</code></pre>

        <h2>Menu item resolution</h2>
        <p>Use <code>areas.resolveHref()</code> to find the menu item corresponding to a Page resource within an Area.</p>
        <x-datafields columns="1">
            <x-datafield label="Friendly path">{{ state.path }}</x-datafield>
            <x-datafield label="Canonical href">{{ state.href }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const item = areas.resolveHref(page.src, areaId);

item.path
item.href</code></pre>
        <p>The friendly <code>path</code> is used for navigation, while the canonical <code>href</code> identifies the resource associated with the menu item.</p>

        <h2>Reverse resolution</h2>
        <p>Use <code>areas.resolvePath()</code> to resolve a friendly navigation path back to its menu item and canonical href.</p>
        <x-datafields columns="2">
            <x-datafield label="Input path">{{ state.path }}</x-datafield>
            <x-datafield label="Resolved href">{{ state.resolved }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const byPath = areas.resolvePath(item.path);
const href = byPath?.href;</code></pre>

        <h2>Resolution sequence</h2>
        <p>The complete resolution process consists of three steps:</p>
        <ol>
            <li>Determine the Area from the current Page source.</li>
            <li>Resolve the Page source to its matching menu item.</li>
            <li>Resolve the menu item's friendly path back to its canonical href.</li>
        </ol>
        <pre x-pre><code>const areaId = areas.resolveAreaId(page.src);
const item = areas.resolveHref(page.src, areaId);
const byPath = item?.path ? areas.resolvePath(item.path) : null;</code></pre>
        <p>Resolution result: <strong>{{ state.matches ? "The canonical hrefs match" : "No matching canonical href" }}</strong></p>

        <h2>Navigation and Page loading</h2>
        <p>The Area resolves navigation data, while the Page loader uses the resolved resource href to load the corresponding Page. These are separate responsibilities.</p>
        <p>Navigate to another Page and return to inspect this example again:</p>
        <p>
            <x-anchor href="../02-pages/04-state.js">Page State</x-anchor> |
            <x-anchor href="../02-pages/03-parameters.js">Page Parameters</x-anchor>
        </p>
        <p>For additional context, see <x-anchor href="02-areas.js">Areas and Menus</x-anchor>.</p>
    `,

    state: {
        src: "",
        areaId: "",
        path: "",
        href: "",
        resolved: "",
        matches: false
    },

    controller({areas, page, state}) {
        return {
            load() {
                const areaId = areas.resolveAreaId(page.src);
                const item = areas.resolveHref(page.src, areaId);
                const byPath = item?.path ? areas.resolvePath(item.path) : null;

                state.src = page.src;
                state.areaId = areaId || "No Area";
                state.path = item?.path || "No friendly path";
                state.href = item?.href || "No menu item";
                state.resolved = byPath?.href || "No path match";
                state.matches = !!item?.href && item.href === byPath?.href;
            }
        };
    }
};
