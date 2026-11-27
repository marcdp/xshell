// class
export default class Menus {

    // options
    static optionsSchema = {
        type: "object",
        required: ["definitions"],
        properties: {
            definitions: { type: "object", additionalProperties: { $ref: "#/$defs/menuDefinition" } }
        },
        additionalProperties: false,
        $defs: {
            menuDefinition: {
                type: "object",
                properties: {
                    scope: {type: "string", enum: ["global", "area"], description: "Whether the menu is shared globally or contextualized for selected Areas. Defaults to area."},
                    label: {type: "string", description: "Human-readable menu title."},
                    description: {type: "string", description: "Description of the menu."},
                    icon: {type: ["string", "null"], description: "Optional icon associated with the menu."},
                    items: {type: "array", items: {$ref: "#/$defs/menuItem"}, description: "Static root menu items."},
                    sources: {
                        type: "array", description: "Root inventory or registered sources, evaluated in array order.",
                        items: {
                            type: "object", required: ["source"], additionalProperties: false,
                            properties: { id: { type: "string", minLength: 1 }, source: { type: "string", minLength: 1 } }
                        }
                    }
                },
                additionalProperties: false
            },
            menuItem: {
                type: "object",
                anyOf: [{ required: ["label"] }, { required: ["id"], properties: { id: { minLength: 1 } } }],
                properties: {
                    id: {type: "string", description: "Optional merge key within the immediate sibling array. An empty string does not match other items."},
                    label: {type: "string", description: "Human-readable menu item label. Identified contributions may omit it during composition."},
                    order: {type: "number", description: "Optional ordering value within the containing menu array. Lower values appear first."},
                    href: {type: ["string", "null"], description: "Canonical XShell navigation target associated with the menu item."},
                    path: {type: "string", description: "Optional public navigation path used as a friendly alias for href."},
                    icon: {type: ["string", "null"], description: "Optional icon associated with the menu item."},
                    default: {type: "boolean", description: "Whether this item is the default navigation target."},
                    tooltip: {type: ["string", "null"], description: "Optional tooltip text for the menu item."},
                    command: {type: ["string", "null"], description: "Optional command associated with the menu item."},
                    shortcut: {
                        description: "One keyboard combination or a non-empty array of alternative combinations.",
                        oneOf: [{ type: "string", minLength: 1 }, { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }]
                    },
                    disabled: {type: "boolean", description: "Whether activation of this menu item is disabled."},
                    target: {type: ["string", "null"], description: "Optional browser target for the menu item's navigation link."},
                    open: {type: ["string", "null"], description: "Optional Page presentation mode for the menu item.", enum: ["auto", "top", "stack", "dialog", "dock", "embed", null]},
                    outlet: {type: ["string", "null"], description: "Optional named Page outlet. The reserved 'self' value is interpreted locally by x-menuitem when open is 'embed'."},
                    class: {type: "string", description: "CSS class to apply to the menu item."},
                    children: {type: "array", items: {$ref: "#/$defs/menuItem"}, description: "Nested menu items."},
                    childrenSource: {type: "string", description: "Name of a registered runtime source for child items.", minLength: 1},
                    description: {type: "string", description: "Human-readable description of the menu item."}
                },
                additionalProperties: false
            }
        }
    };


    // vars
    #areas;
    #bus;
    #config;
    #definitions;
    #globalMenus = new Map();
    #areaMenus = new Map();
    #sources = new Map();
    #instances = [];

    // ctor
    constructor({ areas, bus, config }, { definitions }) {
        this.#areas = areas;
        this.#bus = bus;
        this.#config = config;
        this.#definitions = definitions;

        // Validate selections and publish static global menus before module controllers execute.
        for (const area of areas.getAreas()) {
            for (const [slot, name] of Object.entries(area.menus)) {
                if (!Object.hasOwn(definitions, name)) throw new Error(`Area '${area.id}' menu slot '${slot}' references unknown menu '${name}'.`);
            }
        }
        for (const [name, definition] of Object.entries(definitions)) {
            if (definition.scope !== "global") continue;
            if (definition.sources?.length) throw new Error(`Global menu '${name}' must use static items. Root sources are unsupported.`);
            this.#globalMenus.set(name, this.#createMenu(name, name, null));
        }
    }

    // methods
    init() {
        // Project Area slots after module controllers have registered their sources.
        for (const area of this.#areas.getAreas()) {
            const menus = new Map();
            for (const [slot, name] of Object.entries(area.menus)) {
                menus.set(slot, this.#globalMenus.get(name) ?? this.#createMenu(slot, name, area));
            }
            this.#areaMenus.set(area.id, menus);
        }
    }
    getMenus(areaId = null) {
        // Return selected slots followed by global definitions that are not shadowed by a slot.
        const area = areaId === null ? this.#areas.getCurrentArea() : this.#areas.getArea(areaId);
        if (areaId !== null && !area) return [];
        const menus = this.#areaMenus.get(area?.id);
        const contextual = [...(menus?.values() ?? [])].filter(menu => menu.scope === "area");
        const global = [...this.#globalMenus.values()].filter(menu => menus?.get(menu.name)?.scope !== "area");
        return Object.freeze([...contextual, ...global]);
    }
    getMenu(name, areaId = null) {
        // Prefer the selected or current Area slot over a global definition of the same name.
        const area = areaId === null ? this.#areas.getCurrentArea() : this.#areas.getArea(areaId);
        if (areaId !== null && !area) return null;
        return this.#areaMenus.get(area?.id)?.get(name) ?? this.#globalMenus.get(name) ?? null;
    }
    resolvePath(path) {
        // Only contextual menu aliases participate in Area navigation.
        for (const area of this.#areas.getAreas()) {
            const items = this.#findInArea(area, item => item.path === path);
            if (items) return items.at(-1);
        }
        return null;
    }
    resolveHref(href, areaId = null) {
        if (!href) return null;

        // Honor explicit context, then prefer an href's Area or the target module's participating Areas.
        const target = this.#getHrefIdentity(href);
        const current = this.#areas.getCurrentArea();
        const contextual = this.#areas.getArea(this.#areas.resolveAreaId(target));
        const moduleId = this.#areas.getModuleId(target);
        const areas = this.#areas.getAreas();
        const candidates = areaId !== null ? [this.#areas.getArea(areaId)] : [
            contextual?.prefix ? contextual : null,
            ...areas.filter(area => area.modules.includes(moduleId)),
            current,
            ...areas
        ];
        for (const area of new Set(candidates.filter(Boolean))) {
            const areaHref = this.#buildAreaHref(target, area);
            const items = this.#findInArea(area, item => this.#getHrefIdentity(item.href) === areaHref);
            if (items) return items.at(-1);
        }
        return null;
    }
    getMenuitemBreadcrumb(href, areaId = null) {
        // Match canonical hrefs in the selected Area and expose their ancestor chain.
        const area = areaId === null ? this.#areas.getCurrentArea() : this.#areas.getArea(areaId);
        if (!area || !href) return null;
        const target = this.#getHrefIdentity(href);
        const items = this.#findInArea(area, item => this.#getHrefIdentity(item.href) === target);
        return items?.map(({ label, href, path, open, outlet, icon, module, area }) =>
            ({ label, href, path, open, outlet, ...(icon ? { icon } : {}), module, area })) ?? null;
    }
    registerSource(name, source) {
        // Register a source before composing menus and wire its optional dependency events.
        if (this.#sources.has(name)) throw new Error(`Menu source '${name}' is already registered.`);
        if (!source || typeof source.resolve !== "function") throw new Error(`Menu source '${name}' must provide a resolve() function.`);
        source.refresh = () => this.#refreshSource(name);
        this.#sources.set(name, source);
        for (const event of source.dependsOn || []) {
            this.#bus.addEventListener(event, () => source.refresh());
        }
    }

    // methods (private)
    #findInArea(area, predicate) {
        for (const menu of this.#areaMenus.get(area.id)?.values() ?? []) {
            if (menu.scope !== "area") continue;
            const path = this.#findMenuitemPath(menu.items, predicate);
            if (path) return path;
        }
        return null;
    }
    #createMenu(slot, name, area) {
        // Keep the effective definition stable while publishing immutable item snapshots.
        const definition = this.#definitions[name];
        const { label = name, description = "", icon = null } = definition;
        const instance = { name, area, definition };
        Object.assign(instance, this.#projectMenu(instance));
        if (instance.sources.size) this.#instances.push(instance);
        return Object.freeze({
            name: slot, scope: area ? "area" : "global", label, description, icon,
            get items() { return instance.items; }
        });
    }
    #projectMenu({ definition, name, area, sources: previous }, refreshedName) {
        // Reuse other source results and track only sources that remain in the effective menu.
        const sources = new Map();
        const resolveSource = sourceName => {
            if (sources.has(sourceName)) return sources.get(sourceName);
            if (!this.#sources.has(sourceName)) {
                throw new Error(`Area '${area.id}' menu '${name}' references unregistered menu source '${sourceName}'.`);
            }
            let items = sourceName !== refreshedName ? previous?.get(sourceName) : undefined;
            if (!items) {
                items = this.#sources.get(sourceName).resolve() ?? [];
                if (!Array.isArray(items)) throw new Error(`Menu source '${sourceName}' for Area '${area.id}', menu '${name}' must resolve to an array.`);
                items = structuredClone(items);
            }
            sources.set(sourceName, items);
            return items;
        };

        // Apply root sources to the merged static definition, then normalize the resulting tree.
        let items = definition.items || [];
        for (const { source } of definition.sources || []) {
            const entries = source.startsWith("/") ? this.#resolveInventory(source, name) : resolveSource(source);
            items = this.#mergeSourceItems(items, entries);
        }
        items = this.#projectItems(items, area, name, resolveSource);
        return { items, sources, fingerprint: JSON.stringify(items) };
    }
    #refreshSource(name) {
        // Prepare every affected projection before publishing any changes.
        const updates = this.#instances.filter(instance => instance.sources.has(name))
            .map(instance => [instance, this.#projectMenu(instance, name)]);
        let changed = false;
        for (const [instance, next] of updates) {
            if (instance.fingerprint === next.fingerprint) {
                instance.sources = next.sources;
            } else {
                Object.assign(instance, next);
                changed = true;
            }
        }
        if (changed) this.#bus.emit("xshell:menus:change", {});
        return changed;
    }
    #mergeSourceItems(items, sourceItems) {
        // Dynamic items can extend identified siblings while leaving the static definition intact.
        const result = [...items];
        const indexes = new Map();
        result.forEach(({ id }, index) => {
            if (typeof id === "string" && id && !indexes.has(id)) indexes.set(id, index);
        });
        for (const item of sourceItems) {
            const { id } = item;
            const index = typeof id === "string" && id ? indexes.get(id) : undefined;
            if (index === undefined) {
                if (typeof id === "string" && id) indexes.set(id, result.length);
                result.push(item);
            } else {
                const previous = result[index];
                result[index] = { ...previous, ...item };
                if (Array.isArray(item.children)) result[index].children = this.#mergeSourceItems(previous.children || [], item.children);
            }
        }
        return result;
    }
    #resolveInventory(source, name) {
        // Use the generation-qualified asset path to select the inventory that owns the source.
        const inventories = [["xshell", this.#config.xshell], ...Object.entries(this.#config.modules)];
        const [moduleId, owner] = inventories.find(([, { assets }]) =>
            assets?.path && (source === assets.path || source.startsWith(assets.path + "/"))) ?? [];
        if (!owner?.files) {
            throw new Error(`Menu '${name}' inventory source '${source}' does not identify an effective module asset path.`);
        }
        return this.#createMenuFromModuleFiles(owner.files, source, owner.label || moduleId);
    }
    #projectItems(items, area, name, resolveSource, activeSources = new Set()) {
        // Use stable numeric sorting, with zero for items that omit an explicit order.
        return Object.freeze([...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(item => {
            const { id, description, disabled, target, childrenSource, order = 0 } = item;
            let { label } = item;
            let children = item.children || [];
            if (!area && childrenSource !== undefined) {
                throw new Error(`Global menu '${name}' must use static children. Children source '${childrenSource}' is unsupported.`);
            }
            if (childrenSource) {
                if (activeSources.has(childrenSource)) throw new Error(`Menu '${name}' has a circular children source '${childrenSource}'.`);
                children = this.#mergeSourceItems(children, resolveSource(childrenSource));
            }
            if (label === undefined && id && children.length && !item.path && !item.href && !item.command) label = "";
            if (typeof label !== "string") throw new Error(`Menu '${name}' item '${id ?? ""}' requires a string label.`);

            // Contextualize destinations and derive resource ownership from the winning href.
            const href = area ? this.#buildAreaHref(item.href, area) : item.href;
            const path = area ? this.#buildAreaHref(item.path, area) : item.path;
            const module = href && !href.startsWith("//") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)
                ? this.#areas.getModuleId(this.#getHrefIdentity(href)) : null;
            const shortcut = Array.isArray(item.shortcut) ? Object.freeze([...item.shortcut]) : item.shortcut;
            const nestedSources = childrenSource ? new Set([...activeSources, childrenSource]) : activeSources;
            return Object.freeze({
                ...(id !== undefined ? { id } : {}), label, ...(description !== undefined ? { description } : {}), order, href, path,
                command: item.command ?? null,
                ...(shortcut !== undefined ? { shortcut } : {}),
                ...(disabled !== undefined ? { disabled } : {}),
                ...(target !== undefined ? { target } : {}),
                icon: item.icon ?? null, open: item.open ?? null, outlet: item.outlet ?? null, tooltip: item.tooltip ?? null,
                default: item.default ?? false, class: item.class ?? "", module,
                ...(area ? { area: area.id } : {}),
                children: this.#projectItems(children, area, name, resolveSource, nestedSources)
            });
        }));
    }
    #buildAreaHref(href, area) {
        if (!href) return null;
        if (href.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        const path = href.startsWith("/") ? href : "/" + href;
        if (area.prefix && (path === area.prefix || path.startsWith(area.prefix + "/"))) return path;
        return area.prefix + path;
    }
    #getHrefIdentity(href) {
        if (!href) return href;
        return href.split(/[?#]/, 1)[0];
    }
    #findMenuitemPath(items, predicate, parents = []) {
        for (const item of items || []) {
            const path = [...parents, item];
            if (predicate(item)) return path;
            const found = this.#findMenuitemPath(item.children, predicate, path);
            if (found) return found;
        }
        return null;
    }
    #createMenuFromModuleFiles(files, root, rootItemLabel) {
        // Derive friendly paths and sort keys from inventory filenames.
        const extensions = [".js", ".html", ".md"];
        const getExtension = (path) => extensions.find(extension => path.endsWith(extension));
        const toRuntimePath = (path) => {
            const extension = getExtension(path);
            return extension ? path.substring(0, path.length - extension.length) + (extension == ".md" ? ".md" : ".js") : path;
        };
        const toTitle = (name) => name.replace(/^\d+-/, "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const toPathPart = (name) => name.replace(/^\d+-/, "").replace(/\.[^.]+$/, "");
        const getOrder = (name) => {
            const match = name.match(/^(\d+)-/);
            return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
        };
        const createPath = (parts) => "/" + parts.map(toPathPart).filter(Boolean).join("/");
        const applyResource = (node, file) => {
            const resource = file?.resource?.type === "page" ? file.resource : null;
            if (!resource) return;
            if (typeof resource.title === "string" && resource.title) node.label = resource.title;
            if (typeof resource.description === "string") node.description = resource.description;
            if (typeof resource.icon === "string") node.icon = resource.icon;
        };
        const ensureNode = (items, name, href = null, pathParts = [], file = null) => {
            let node = items.find(item => item._name === toPathPart(name));
            if (!node) {
                node = {
                    _name: toPathPart(name),
                    _order: getOrder(name),
                    label: toTitle(name),
                    href: href ? toRuntimePath(href) : null,
                    path: createPath(pathParts),
                    children: []
                };
                items.push(node);
            } else if (href) {
                node.href = toRuntimePath(href);
            }
            applyResource(node, file);
            return node;
        };
        // normalize the root index through the same runtime path rule as nested pages
        const rootIndex = files.find(file =>
            extensions.some(extension => file.path === `${root}/index${extension}`
            )
        );
        const rootItem = {
            label: rootItemLabel,
            href: rootIndex ? toRuntimePath(rootIndex.path) : `${root}/index.js`,
            path: "/",
            default: true,
            children: []
        };

        const menu = rootItem.children;
        for (const file of files) {
            if (!file.path.startsWith(root + "/")) continue;
            const extension = getExtension(file.path);
            if (!extension) continue;
            if (rootIndex && file.path === rootIndex.path) continue;
            const relative = file.path.substring(root.length + 1);
            const parts = relative.split("/");
            let items = menu;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;

                if (isFile) {
                    if (extensions.some(ext => part === `index${ext}`)) continue;
                    ensureNode(items, part, file.path, parts.slice(0, i + 1), file);
                    continue;
                }

                const node = ensureNode(items, part, null, parts.slice(0, i + 1));
                const directory = parts.slice(0, i + 1).join("/");
                const indexFile = files.find(file =>
                    extensions.some(ext =>file.path === `${root}/${directory}/index${ext}`)
                );

                if (indexFile) {
                    node.href = toRuntimePath(indexFile.path);
                    applyResource(node, indexFile);
                }
                items = node.children;
            }
        }
        const clean = (items) => items
            .sort((a, b) => a._order - b._order || a.label.localeCompare(b.label))
            .map(({ _name, _order, children, ...item }) => ({
                ...item,
                ...(children.length ? { children: clean(children) } : {})
            }));

        rootItem.children = clean(rootItem.children);
        return [rootItem];
    }
}
