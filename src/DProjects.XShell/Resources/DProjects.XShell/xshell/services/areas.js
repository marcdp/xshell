// class
export default class Areas {

    // options
    static optionsSchema = {
        type: "object",
        required: ["default", "global", "definitions"],
        properties: {
            default: { type: ["string", "null"], minLength: 1, description: "Identifier of the default area." },
            global: { type: "array", items: { type: "string" }, description: "Global menu names." },
            definitions: {
                type: "object",
                additionalProperties: {
                    type: "object",
                    properties: {
                        prefix: { type: "string", description: "Application navigation Path prefix assigned to the Area." },
                        label: { type: "string", description: "Human-readable area label." },
                        icon: { type: ["string", "null"], description: "Optional icon associated with the area." },
                        modules: { type: "array", items: { type: "string" }, description: "Modules composed into the area, in composition order." },
                        order: { type: "number", description: "Optional ordering value for the area." },
                        description: { type: "string", description: "Human-readable area description." }
                    },
                    additionalProperties: false,
                    description: "Configuration of a navigation area."
                },
                description: "Area definitions keyed by area identifier."
            },
            assetsPath: { type: "string", description: "Base path for area assets." }
        },
        additionalProperties: false,
        description: "Application areas and the default active area."
    };

    // vars
    _config = null;
    _options = null;
    _bus = null;
    _areas = [];
    _assetsBasePath = null;
    _currentAreaId = null;
    _sources = Object.create(null);
    _sourceTargets = new Map();
    _globalMenus = Object.create(null);

    // ctor
    constructor({ config, bus }, options = {}) {
        this._options = options;    
        // initialize injected dependencies and Area configuration
        this._config = config;
        this._bus = bus;
        this._assetsBasePath = config.xshell.assets.basePath;
        const definitions = options.definitions || {};
        const defaultAreaId = options.default;

        // validate semantic Area configuration against the effective modules
        if (defaultAreaId !== null && !Object.hasOwn(definitions, defaultAreaId)) throw new Error(`Default area '${defaultAreaId}' is not defined.`);
        const prefixes = new Map();
        for (const [areaId, area] of Object.entries(definitions)) {
            const prefix = this._normalizeAreaPrefix(area.prefix);
            if (prefixes.has(prefix)) throw new Error(`Areas '${prefixes.get(prefix)}' and '${areaId}' have duplicate normalized prefix '${prefix}'.`);
            prefixes.set(prefix, areaId);
            for (const moduleId of area.modules || []) {
                if (!Object.hasOwn(config.modules, moduleId)) throw new Error(`Area '${areaId}' references unknown module '${moduleId}'.`);
            }
        }
        for (const menuName of options.global || []) {
            for (const [moduleId, module] of Object.entries(config.modules)) {
                const menu = module.menus?.[menuName];
                if (menu !== undefined && !Array.isArray(menu)) throw new Error(`Global menu '${menuName}' from module '${moduleId}' must be a static array.`);
            }
        }

        // create navigation contexts without accepting a configured home
        const areas = [];
        for (const [areaId, areaConfig] of Object.entries(definitions)) {
            const { home, ...options } = areaConfig;
            areas.push({
                ...options,
                id: areaId,
                label: areaConfig.label || areaId,
                icon: areaConfig.icon || null,
                prefix: this._normalizeAreaPrefix(areaConfig.prefix),
                modules: Object.freeze([...(areaConfig.modules || [])]),
                order: areaConfig.order || 0,
                default: areaId === defaultAreaId,
                menus: Object.freeze({}),
                routes: Object.freeze([]),
                home: null
            });
        }
        areas.sort((a, b) => {
            if (a.default !== b.default) return a.default ? -1 : 1;
            if (a.order !== b.order) return a.order - b.order;
            return a.label.localeCompare(b.label);
        });
        this._areas = Object.freeze(areas);
        this._currentAreaId = this.getDefaultArea()?.id || null;

        // Compose global definitions in configuration order before projecting defaults.
        for (const globalMenuId of options.global || []) {
            let globalMenu = [];
            for (const [moduleId, module] of Object.entries(config.modules)) {
                const menuDefinition = module.menus?.[globalMenuId];
                if (menuDefinition) globalMenu = this._mergeMenuitems(globalMenu, menuDefinition, moduleId);
            }
            this._globalMenus[globalMenuId] = Object.freeze(this._sortMenuitems(globalMenu).map(item => this._cloneMenuitem(item)));
        }

        // navigation determines the current area from its URL
        bus.addEventListener("xshell:navigation:end", evt => {
            const areaId = this.resolveAreaId(evt.detail.src);
            if (areaId) this._setCurrentArea(areaId);
        });
    }

    // methods
    init({ modules }) {
        // compose effective menus after canonical modules exist
        const findDefaultHref = (items) => {
            for (const item of items || []) {
                if (item.default) return item.path || item.href || null;
                const href = findDefaultHref(item.children);
                if (href) return href;
            }
            return null;
        };
        const findFirstVisibleHref = (items) => {
            for (const item of items || []) {
                const href = item.path || item.href;
                if (href) return href;

                const childHref = findFirstVisibleHref(item.children);
                if (childHref) return childHref;
            }
            return null;
        };
        // process each area
        for (const area of this._areas) {
            const definitions = new Map();
            const routes = [];
            for (const moduleId of area.modules) {
                const module = modules.getModuleById(moduleId);
                if (!module) {
                    throw new Error(`Area '${area.id}' references unknown module '${moduleId}'.`);
                }
                for (const [menuName, menuDefinition] of Object.entries(module.config.menus || {})) {
                    let menuItems;
                    if (Array.isArray(menuDefinition)) {
                        // menuDefinition is an array of menu items
                        menuItems = menuDefinition;
                    } else if (typeof menuDefinition === "string" && menuDefinition.startsWith("/")) {
                        // menuDefinition is a path to a menu
                        const path = menuDefinition;
                        const title = this._config.modules[moduleId]?.label;
                        const files = this._config.modules[moduleId]?.files;
                        const menu = this._createMenuFromModuleFiles(files, path, title, [".js", ".html", ".md"], true);
                        menuItems = menu;
                    } else if (typeof menuDefinition === "string") {
                        // menuDefinition is a menu source identifier
                        const source = this._sources[menuDefinition];
                        if (!source) {
                            throw new Error(`Module '${module.id}' menu '${menuName}' references unregistered menu source '${menuDefinition}'.`);
                        }
                        menuItems = source.resolve?.() || [];
                    } else {
                        continue;
                    }
                    if (!Array.isArray(menuItems)) {
                        throw new Error(`Menu source '${menuDefinition}' for Area '${area.id}', module '${module.id}', menu '${menuName}' must resolve to an array.`);
                    }
                    definitions.set(menuName, this._mergeMenuitems(definitions.get(menuName) || [], menuItems, module.id));
                }
                for (const [path, href] of Object.entries(module.routes || {})) {
                    routes.push(Object.freeze({ path, href, module: module.id }));
                }
            }
            // Project each merged menu once, including its effective source registrations.
            const menus = Object.fromEntries([...definitions].map(([name, items]) => [
                name, Object.freeze(this._sortMenuitems(items).map(item => this._cloneMenuitem(item, area)))
            ]));
            area.menus = Object.freeze(menus);
            area.routes = Object.freeze(routes);
            area.home = findDefaultHref(menus.navigation) || findFirstVisibleHref(menus.navigation);
            Object.freeze(area);
        }
    }
    getAreas() {
        return this._areas;
    }
    getArea(id) {
        return this._areas.find(area => area.id === id) || null;
    }
    getDefaultArea() {
        return this._areas.find(area => area.default) || this._areas[0] || null;
    }
    getCurrentArea() {
        return this.getArea(this._currentAreaId) || this.getDefaultArea();
    }
    resolveAreaId(href) {
        if (!href) return null;
        // longest matching navigation prefix wins
        const areas = [...this._areas].sort((a, b) => b.prefix.length - a.prefix.length);
        for (const area of areas) {
            if (this._matchesPrefix(href, area.prefix)) return area.id;
        }
        return null;
    }
    resolvePath(path) {
        for (const area of this._areas) {
            for (const menu of Object.values(area.menus)) {
                const item = this._findMenuitemPath(menu, menuitem => menuitem.path === path)?.at(-1);
                if (item) return item;
            }
        }
        return null;
    }
    resolveHref(href, areaId = null) {
        if (!href) return null;
        // search the selected Area or only Areas associated with the target module
        const targetHref = this._getHrefIdentity(href);
        const moduleId = this.getModuleId(targetHref);
        let areas;
        if (areaId) {
            areas = [this.getArea(areaId)].filter(Boolean);
        } else if (moduleId) {
            areas = this._areas.filter(area => area.modules.includes(moduleId));
        } else {
            areas = [this.getCurrentArea()].filter(Boolean);
        }
        for (const area of areas) {
            const areaHref = this._buildAreaHref(targetHref, area);
            for (const menu of Object.values(area.menus)) {
                const menuitems = this._findMenuitemPath(menu, menuitem => this._getHrefIdentity(menuitem.href) === areaHref);
                if (menuitems) return menuitems.at(-1);
            }
        }
        return null;
    }
    getModuleId(href) {
        const assetsIndex = href.lastIndexOf(this._assetsBasePath + "/");
        return assetsIndex === -1 ? null : href.substring(assetsIndex + this._assetsBasePath.length + 1).split("/")[0] || null;
    }
    getMenus(areaId = null) {
        const area = areaId ? this.getArea(areaId) : this.getCurrentArea();
        return area ? Object.values(area.menus) : [];
    }
    getMenu(name, areaId = null) {
        const area = areaId ? this.getArea(areaId) : this.getCurrentArea();
        return area?.menus[name] || [];
    }
    getMenuitemBreadcrumb(href, areaId = null) {
        const area = areaId ? this.getArea(areaId) : this.getCurrentArea();
        if (!area || !href) return null;
        // search only the selected area's effective menus
        const targetHref = this._getHrefIdentity(href);
        for (const menu of Object.values(area.menus)) {
            const menuitems = this._findMenuitemPath(menu, menuitem => this._getHrefIdentity(menuitem.href) === targetHref);
            if (menuitems) {
                return menuitems.map(menuitem => ({
                    label: menuitem.label,
                    href: menuitem.href,
                    path: menuitem.path,
                    embedded: menuitem.embedded,
                    ...(menuitem.icon ? { icon: menuitem.icon } : {}),
                    module: menuitem.module,
                    area: menuitem.area
                }));
            }
        }
        return null;
    }
    registerSource(name, source) {
        // register a dynamic menu source
        if (Object.hasOwn(this._sources, name)) {
            throw new Error(`Menu source '${name}' is already registered.`);
        }        
        if (!source || typeof source.resolve !== "function") {
            throw new Error(`Menu source '${name}' must provide a resolve() function.`);
        }        
        this._sources[name] = source;
        // refresh every effective copy backed by this source
        source.refresh = () => {
            let changed = false;
            for (const target of [...this._sourceTargets.values()]) {
                if (target.name !== name || !this._sourceTargets.has(target.children)) continue;
                const items = this._resolveSourceChildren(target);
                const definition = JSON.stringify(items);
                if (definition === target.definition) continue;

                // Reuse unchanged static children even when sorting moves them to a different position.
                const previous = new Map(target.items.map((item, index) => [item, target.children[index]]));
                const targets = new Map();
                const children = items.map(item => {
                    if (!previous.has(item)) return this._cloneMenuitem(item, target.area, targets);
                    const child = previous.get(item);
                    previous.delete(item);
                    return child;
                });
                changed ||= JSON.stringify(target.children) !== JSON.stringify(children);
                this._removeSourceTargets(previous.values());
                target.children.splice(0, target.children.length, ...children);
                for (const [collection, nested] of targets) this._sourceTargets.set(collection, nested);
                target.items = items;
                target.definition = definition;
            }
            return changed;
        };
        for (const event of source.dependsOn || []) {
            this._bus.addEventListener(event, () => {
                if (source.refresh()) this._bus.emit("xshell:menus:change", {});
            });
        }
    }
    getGlobalMenu(name) {
        return this._globalMenus[name] || null;
    }

    // methods (private)
    _sortMenuitems(items) {
        // Stable sort keeps the composition order for equal values.
        return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    _mergeMenuitems(target, source, moduleId) {
        // The target has already been merged. Match only the first position in this array.
        const result = [...target];
        const indexes = new Map();
        const getId = item => typeof item?.id === "string" && item.id ? item.id : null;
        for (const [index, item] of result.entries()) {
            const id = getId(item);
            if (id !== null) indexes.set(id, index);
        }
        for (const item of source) {
            const id = getId(item);
            const index = indexes.get(id) ?? result.length;
            if (id !== null) indexes.set(id, index);
            result[index] = this._mergeMenuitemValue(result[index], item, moduleId);
        }
        return result;
    }
    _mergeMenuitemValue(previous, value, moduleId) {
        // Merge raw properties so projection defaults cannot overwrite an omitted field.
        if (Array.isArray(value)) return this._mergeMenuitems(Array.isArray(previous) ? previous : [], value, moduleId);
        if (value === null || typeof value !== "object") return value;
        const base = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
        const properties = Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key, this._mergeMenuitemValue(Object.hasOwn(base, key) ? base[key] : undefined, entry, key === "children" ? moduleId : undefined)
        ]));
        const item = { ...base, ...properties };
        if (moduleId !== undefined) {
            // The contributor of the winning href owns the target. The children source has its own owner.
            item.module = !base.href || Object.hasOwn(value, "href") ? moduleId : base.module;
            item.childrenSourceModule = Object.hasOwn(value, "childrenSource") ? moduleId : base.childrenSourceModule;
        }
        return item;
    }
    _cloneMenuitem(menuitem, area = null, sourceTargets = this._sourceTargets) {
        // An identified, targetless group can contribute children even in a menu where no label is supplied.
        const moduleId = menuitem.module;
        let label = menuitem.label;
        if (label === undefined && typeof menuitem.id === "string" && menuitem.id &&
            menuitem.children?.length && !menuitem.path && !menuitem.href && !menuitem.command) label = "";
        if (typeof label !== "string") {
            const context = area ? `Area '${area.id}'` : "Global menu";
            throw new Error(`${context} item '${menuitem.id ?? ""}' from module '${moduleId}' requires a string label.`);
        }

        // Normalize the effective item and attach only its winning children source.
        const result = {
            ...(menuitem.id !== undefined ? { id: menuitem.id } : {}),
            label,
            order: menuitem.order ?? 0,
            href: area ? this._buildAreaHref(menuitem.href, area) : menuitem.href,
            path: area ? this._buildAreaHref(menuitem.path, area) : menuitem.path,
            command: menuitem.command ?? null,
            icon: menuitem.icon ?? null,
            embedded: menuitem.embedded ?? false,
            open: menuitem.open ?? null,
            tooltip: menuitem.tooltip ?? null,
            default: menuitem.default ?? false,
            class: menuitem.class ?? "",
            module: moduleId,
            ...(area ? { area: area.id } : { outlet: menuitem.outlet || null }),
            children: []
        };
        const staticItems = menuitem.children || [];
        if (area && menuitem.childrenSource) {
            const name = menuitem.childrenSource;
            const sourceModule = menuitem.childrenSourceModule;
            if (!Object.hasOwn(this._sources, name)) {
                throw new Error(`Module '${sourceModule}' menu item '${label}' references unregistered children source '${name}'.`);
            }
            const target = { name, moduleId: sourceModule, area, staticItems, children: result.children };
            const items = this._resolveSourceChildren(target);
            result.children.push(...items.map(item => this._cloneMenuitem(item, area, sourceTargets)));
            target.items = items;
            target.definition = JSON.stringify(items);
            sourceTargets.set(result.children, target);
        } else {
            // Keep the static definitions in declaration order for ties on later source refreshes.
            const children = this._sortMenuitems([...staticItems]);
            for (let i = 0; i < children.length; i++) children[i] = this._cloneMenuitem(children[i], area, sourceTargets);
            result.children = Object.freeze(children);
        }
        return Object.freeze(result);
    }
    _resolveSourceChildren({ name, moduleId, staticItems }) {
        // Reapply the current source results to the unchanged static definitions on every refresh.
        const items = this._sources[name].resolve() || [];
        if (!Array.isArray(items)) throw new Error(`Children source '${name}' from module '${moduleId}' must resolve to an array.`);
        return this._sortMenuitems(this._mergeMenuitems(staticItems, items, moduleId));
    }
    _removeSourceTargets(items) {
        // Forget descendants of replaced children so later refreshes only visit live collections.
        for (const item of items) {
            this._sourceTargets.delete(item.children);
            this._removeSourceTargets(item.children);
        }
    }
    _buildAreaHref(href, area) {
        if (!href) return null;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        const path = href.startsWith("/") ? href : "/" + href;
        if (area.prefix && (path === area.prefix || path.startsWith(area.prefix + "/"))) return path;
        return area.prefix + path;
    }
    _getHrefIdentity(href) {
        if (!href) return href;
        const queryIndex = href.indexOf("?");
        const hashIndex = href.indexOf("#");
        const suffixIndexes = [queryIndex, hashIndex].filter(index => index !== -1);
        return suffixIndexes.length ? href.substring(0, Math.min(...suffixIndexes)) : href;
    }
    _setCurrentArea(areaId) {
        if (this._currentAreaId === areaId) return;
        const area = this.getArea(areaId);
        if (!area) throw new Error(`Unknown area '${areaId}'`);
        this._currentAreaId = areaId;
        this._bus.emit("xshell:area:change", { areaId });
    }
    _matchesPrefix(href, prefix) {
        if (prefix === "") return href.startsWith("/");
        return href === prefix || href.startsWith(prefix + "/") || href.startsWith(prefix + "?");
    }
    _findMenuitemPath(items, predicate, parents = []) {
        for (const item of items || []) {
            const path = [...parents, item];
            if (predicate(item)) return path;
            const found = this._findMenuitemPath(item.children, predicate, path);
            if (found) return found;
        }
        return null;
    }
    _normalizeAreaPrefix(prefix) {
        if (!prefix || prefix === "/") return "";
        return "/" + prefix.replace(/^\/+|\/+$/g, "");
    }
    _createMenuFromModuleFiles(files, root, rootItemLabel, extensions, createPaths) {
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
        const ensureNode = (items, name, href = null, pathParts = []) => {
            let node = items.find(item => item._name === toPathPart(name));
            if (!node) {
                node = {
                    _name: toPathPart(name),
                    _order: getOrder(name),
                    label: toTitle(name),
                    href: href ? toRuntimePath(href) : null,
                    ...(createPaths ? { path: createPath(pathParts) } : {}),
                    children: []
                };
                items.push(node);
            } else if (href) {
                node.href = toRuntimePath(href);
            }
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
            ...(createPaths ? { path: "/" } : {}),
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
                    ensureNode(items, part, file.path, parts.slice(0, i + 1));
                    continue;
                }

                const node = ensureNode(items, part, null, parts.slice(0, i + 1));
                const directory = parts.slice(0, i + 1).join("/");
                const indexFile = files.find(file =>
                    extensions.some(ext =>file.path === `${root}/${directory}/index${ext}`)
                );

                if (indexFile) {
                    node.href = toRuntimePath(indexFile.path);
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
