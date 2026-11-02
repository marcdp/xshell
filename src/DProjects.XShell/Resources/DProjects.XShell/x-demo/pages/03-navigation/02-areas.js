
export default {
    meta: {
        title: "Areas and Menus",
        description: "Inspects the current Area, its participating Modules, and its composed navigation menu."
    },

    template: `
        <p>An Area is the active navigation context: it selects participating Modules, composes their menu contributions, and establishes a URL prefix. It does not create additional Module instances.</p>

        <h2>Area configuration</h2>
        <p>Areas are configured under <code>xshell.areas</code>. The cookbook defines a default Area with a URL prefix and a list of participating Modules.</p>
        <pre x-pre><code>"xshell": {
    "areas": {
        "default": "cookbook",
        "definitions": {
            "cookbook": {
                "prefix": "cookbook",
                "label": "Cookbook",
                "modules": ["x-demo"]
            }
        }
    }
}</code></pre>

        <h2>Current Area</h2>
        <p>The <code>areas</code> service provides information about the active navigation context.</p>
        <x-datafields columns="2">
            <x-datafield label="Area ID">{{ state.id }}</x-datafield>
            <x-datafield label="Label">{{ state.label }}</x-datafield>
            <x-datafield label="URL prefix">{{ state.prefix }}</x-datafield>
            <x-datafield label="Participating Modules">{{ state.modules }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const area = areas.getCurrentArea();

area.id
area.label
area.prefix
area.modules</code></pre>

        <h2>Composed navigation menu</h2>
        <p>The <code>areas.getMenu()</code> method returns the composed menu for an Area. Each item contains navigation information and may contain child items.</p>
        <x-datafields label="Navigation items" columns="1">
            <x-datafield x-for="item in state.items" x-attr:label="item.label">
                <p>Path: <code>{{ item.path }}</code></p>
                <p>Child Pages: {{ item.children }}</p>
            </x-datafield>
        </x-datafields>
        <pre x-pre><code>const menu = areas.getMenu("navigation", area.id);
const items = menu[0]?.children || [];</code></pre>

        <h2>Menu paths and Page resources</h2>
        <p>A menu item distinguishes the friendly navigation path from the canonical resource href used to load a Page.</p>
        <x-datafields columns="1">
            <x-datafield label="Friendly path">{{ state.examplePath }}</x-datafield>
            <x-datafield label="Canonical href">{{ state.exampleHref }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const areaId = areas.resolveAreaId(page.src);
const item = areas.resolveHref(page.src, areaId);

item.path
item.href</code></pre>
        <p>The <code>areas</code> service resolves navigation paths, while the Page loader uses the resolved resource to load the Page.</p>
        <p><x-anchor href="05-resolution.js">Explore Path Resolution</x-anchor></p>

        <h2>Area composition versus Module contributions</h2>
        <p>This Page inspects the result of Area composition. To see how <code>x-demo</code> declares its <code>/pages</code> menu source and routes, continue with <x-anchor href="../06-modules/05-menus.js">Module Menus and Routes</x-anchor>.</p>
    `,

    state: {
        id: "",
        label: "",
        prefix: "",
        modules: "",
        items: [],
        examplePath: "",
        exampleHref: ""
    },

    controller({areas, page, state}) {
        return {
            load() {
                const area = areas.getCurrentArea();
                const menu = areas.getMenu("navigation", area?.id);
                const areaId = areas.resolveAreaId(page.src);
                const item = areas.resolveHref(page.src, areaId);

                state.id = area?.id || "";
                state.label = area?.label || "";
                state.prefix = area?.prefix || "/";
                state.modules = area?.modules?.join(", ") || "";
                state.items = (menu[0]?.children || []).map(item => ({
                    label: item.label,
                    path: item.path,
                    children: item.children?.length || 0
                }));
                state.examplePath = item?.path || "No friendly path";
                state.exampleHref = item?.href || "No menu item";
            }
        };
    }
};
