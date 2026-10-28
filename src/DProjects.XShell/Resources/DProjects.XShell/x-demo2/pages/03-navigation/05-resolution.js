export default {
    meta: {
        title: "Path Resolution",
        description: "Follow a friendly menu path to the canonical Page href."
    },

    template: `
        <p>A menu path is a friendly destination. The menu href identifies the Page resource within an Area.</p>
        <p>This Page's current source: {{ state.src }}</p>
        <p>Matching menu path: {{ state.path }}</p>
        <p>Canonical menu href: {{ state.href }}</p>
        <p>Resolving the path returns: {{ state.resolved }}</p>
        <p>The Area resolves navigation data; <code>x-page</code> then removes the Area prefix for module resource loading.</p>
        <p><x-anchor href="../02-pages/04-state.js">Navigate to Page State</x-anchor> and return to inspect this Page again.</p>
    `,

    state: {
        src: "",
        path: "",
        href: "",
        resolved: ""
    },

    controller({ areas, page, state }) {
        return {
            load() {
                const areaId = areas.resolveAreaId(page.src);
                const item = areas.resolveHref(page.src, areaId);
                const byPath = item?.path ? areas.resolvePath(item.path) : null;
                state.src = page.src;
                state.path = item?.path || "No friendly path";
                state.href = item?.href || "No menu item";
                state.resolved = byPath?.href || "No path match";
            }
        };
    }
};
