import { matchesPathPrefix, normalizeUrlPrefix } from "../utils/urls.js";

const previousMenuitemIndex = Symbol("previousMenuitemIndex");
const defaultGlobalPrefix = "/global";

// class
export default class Areas {

    // options
    static optionsSchema = {
        type: "object",
        required: ["default", "definitions"],
        properties: {
            default: { type: ["string", "null"], minLength: 1, description: "Identifier of the default area." },
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
    #config = null;
    #options = null;
    #bus = null;
    #areas = [];
    #assetsBasePath = null;
    #globalPrefix = null;
    #currentAreaId = null;
    #sources = Object.create(null);
    #sourceTargets = new Map();
    #globalMenus = Object.create(null);

    // ctor
    constructor({ config, bus }, options = {}) {
        this.#options = options;
        // initialize injected dependencies and Area configuration
        this.#config = config;
        this.#bus = bus;
        this.#assetsBasePath = config.xshell.assets.basePath;

        // Navigation and Page loading share the prefix validated against the effective Areas.
        const configuredPrefix = config.xshell.services?.navigation?.options?.globalPrefix;
        const globalPrefix = configuredPrefix === undefined ? defaultGlobalPrefix : configuredPrefix;
        if (typeof globalPrefix !== "string" || !globalPrefix.startsWith("/") || globalPrefix === "/" ||
            globalPrefix.includes("//") || globalPrefix.includes("\\") || /%(?![0-9a-f]{2})/i.test(globalPrefix) ||
            normalizeUrlPrefix(globalPrefix) !== globalPrefix.replace(/\/?$/, "/")) {
            throw new Error("Navigation globalPrefix must be a non-empty rooted application-relative path.");
        }
        this.#globalPrefix = globalPrefix.replace(/\/$/, "");
        const conflictsWithGlobal = prefix => matchesPathPrefix(prefix, this.#globalPrefix) || matchesPathPrefix(this.#globalPrefix, prefix);
        if (conflictsWithGlobal(this.#assetsBasePath)) {
            throw new Error(`Navigation globalPrefix '${this.#globalPrefix}' conflicts with the asset namespace '${this.#assetsBasePath}'.`);
        }
        const definitions = options.definitions || {};
        const defaultAreaId = options.default;

        // validate semantic Area configuration against the effective modules
        if (defaultAreaId !== null && !Object.hasOwn(definitions, defaultAreaId)) throw new Error(`Default area '${defaultAreaId}' is not defined.`);
        const prefixes = new Map();
        for (const [areaId, area] of Object.entries(definitions)) {
            const prefix = this.#normalizeAreaPrefix(area.prefix);
            if (prefix && conflictsWithGlobal(prefix)) {
                throw new Error(`Navigation globalPrefix '${this.#globalPrefix}' conflicts with Area '${areaId}' prefix '${prefix}'.`);
            }
            if (prefixes.has(prefix)) throw new Error(`Areas '${prefixes.get(prefix)}' and '${areaId}' have duplicate normalized prefix '${prefix}'.`);
            prefixes.set(prefix, areaId);
            for (const moduleId of area.modules || []) {
                if (!Object.hasOwn(config.modules, moduleId)) throw new Error(`Area '${areaId}' references unknown module '${moduleId}'.`);
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
                prefix: this.#normalizeAreaPrefix(areaConfig.prefix),
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
        this.#areas = Object.freeze(areas);
        this.#currentAreaId = this.getDefaultArea()?.id || null;

        // Group contributions in configuration order and resolve explicit scopes before composing any menu.
        const menus = new Map();
        for (const [moduleId, module] of Object.entries(config.modules)) {
            for (const [name, contribution] of Object.entries(module.menus || {})) {
                if (!menus.has(name)) menus.set(name, { contributions: [] });
                const menu = menus.get(name);
                const { scope } = contribution;
                if (scope !== undefined) {
                    if (menu.scope !== undefined && menu.scope !== scope) {
                        throw new Error(`Menu '${name}' has conflicting scope declarations: ` +
                            `'${menu.scope}' from module '${menu.moduleId}' and '${scope}' from module '${moduleId}'.`);
                    }
                    menu.scope ??= scope;
                    menu.moduleId ??= moduleId;
                }
                menu.contributions.push({ moduleId, contribution });
            }
        }

        // Compose each global menu once from all selected modules.
        for (const [name, { scope, contributions }] of menus) {
            if (scope !== "global") continue;
            let definition;
            for (const { moduleId, contribution } of contributions) {
                if (contribution.source !== undefined) {
                    throw new Error(`Global menu '${name}' from module '${moduleId}' must use static contributions. Source '${contribution.source}' is unsupported.`);
                }
                definition = this.#mergeMenuDefinition(definition, contribution, moduleId);
            }
            this.#globalMenus[name] = this.#createMenuDefinition(name, definition);
        }

        // navigation determines the current area from its URL
        bus.addEventListener("xshell:navigation:end", evt => {
            const areaId = this.resolveAreaId(evt.detail.src);
            if (areaId) this.#setCurrentArea(areaId);
        });
    }

    get globalPrefix() {
        return this.#globalPrefix;
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
        for (const area of this.#areas) {
            const definitions = new Map();
            const routes = [];
            for (const moduleId of area.modules) {
                const module = modules.getModuleById(moduleId);
                if (!module) {
                    throw new Error(`Area '${area.id}' references unknown module '${moduleId}'.`);
                }
                for (const [name, contribution] of Object.entries(module.config.menus || {})) {
                    // Compose Area menus and resolve each module's source after its explicit items.
                    if (Object.hasOwn(this.#globalMenus, name)) continue;
                    const definition = this.#mergeMenuDefinition(definitions.get(name), contribution, module.id);
                    if (contribution.source !== undefined) {
                        const items = this.#resolveMenuSource(contribution.source, name, module.id, area);
                        definition.items = this.#mergeMenuitems(definition.items, items, module.id);
                    }
                    definitions.set(name, definition);
                }
                for (const [path, href] of Object.entries(module.routes || {})) {
                    routes.push(Object.freeze({ path, href, module: module.id }));
                }
            }
            // Project each merged menu once, including its effective source registrations.
            const menus = Object.fromEntries([...definitions].map(([name, definition]) => [
                name, this.#createMenuDefinition(name, definition, area)
            ]));
            area.menus = Object.freeze(menus);
            area.routes = Object.freeze(routes);
            const navigationItems = menus.navigation?.items;
            area.home = findDefaultHref(navigationItems) || findFirstVisibleHref(navigationItems);
            Object.freeze(area);
        }
    }
    getAreas() {
        return this.#areas;
    }
    getArea(id) {
        return this.#areas.find(area => area.id === id) || null;
    }
    getDefaultArea() {
        return this.#areas.find(area => area.default) || this.#areas[0] || null;
    }
    getCurrentArea() {
        return this.getArea(this.#currentAreaId) || this.getDefaultArea();
    }
    resolveAreaId(href) {
        if (!href) return null;

        // Reserve the global namespace before considering any Area, including the root Area.
        const path = this.#getHrefIdentity(href);
        if (matchesPathPrefix(path, this.#globalPrefix)) return null;
        // longest matching navigation prefix wins
        const areas = [...this.#areas].sort((a, b) => b.prefix.length - a.prefix.length);
        for (const area of areas) {
            if (matchesPathPrefix(path, area.prefix) || (!area.prefix && path.startsWith("/"))) return area.id;
        }
        return null;
    }
    resolvePath(path) {
        for (const area of this.#areas) {
            for (const menu of Object.values(area.menus)) {
                const item = this.#findMenuitemPath(menu.items, menuitem => menuitem.path === path)?.at(-1);
                if (item) return item;
            }
        }
        return null;
    }
    resolveHref(href, areaId = null) {
        if (!href) return null;
        // search the selected Area or only Areas associated with the target module
        const targetHref = this.#getHrefIdentity(href);
        const moduleId = this.getModuleId(targetHref);
        let areas;
        if (areaId) {
            areas = [this.getArea(areaId)].filter(Boolean);
        } else if (moduleId) {
            areas = this.#areas.filter(area => area.modules.includes(moduleId));
        } else {
            areas = [this.getCurrentArea()].filter(Boolean);
        }
        for (const area of areas) {
            const areaHref = this.#buildAreaHref(targetHref, area);
            for (const menu of Object.values(area.menus)) {
                const menuitems = this.#findMenuitemPath(menu.items, menuitem => this.#getHrefIdentity(menuitem.href) === areaHref);
                if (menuitems) return menuitems.at(-1);
            }
        }
        return null;
    }
    getModuleId(href) {
        const assetsIndex = href.lastIndexOf(this.#assetsBasePath + "/");
        return assetsIndex === -1 ? null : href.substring(assetsIndex + this.#assetsBasePath.length + 1).split("/")[0] || null;
    }
    getMenus(areaId = null) {
        // Resolve the requested Area while rejecting unknown explicit identifiers.
        const area = areaId !== null ? this.getArea(areaId) : this.getCurrentArea();
        if (areaId !== null && !area) return [];

        // Keep Area menus first and append shared global menus without duplicate names.
        const menus = area ? Object.values(area.menus) : [];
        const areaNames = new Set(menus.map(menu => menu.name));
        return [...menus, ...Object.values(this.#globalMenus).filter(menu => !areaNames.has(menu.name))];
    }
    getMenu(name, areaId = null) {
        // Resolve the requested Area while rejecting unknown explicit identifiers.
        const area = areaId !== null ? this.getArea(areaId) : this.getCurrentArea();
        if (areaId !== null && !area) return null;

        // Prefer the effective Area menu and then fall back to the shared global menu.
        if (area && Object.hasOwn(area.menus, name)) return area.menus[name];
        return Object.hasOwn(this.#globalMenus, name) ? this.#globalMenus[name] : null;
    }
    getMenuitemBreadcrumb(href, areaId = null) {
        const area = areaId ? this.getArea(areaId) : this.getCurrentArea();
        if (!area || !href) return null;
        // search only the selected area's effective menus
        const targetHref = this.#getHrefIdentity(href);
        for (const menu of Object.values(area.menus)) {
            const menuitems = this.#findMenuitemPath(menu.items, menuitem => this.#getHrefIdentity(menuitem.href) === targetHref);
            if (menuitems) {
                return menuitems.map(menuitem => ({
                    label: menuitem.label,
                    href: menuitem.href,
                    path: menuitem.path,
                    open: menuitem.open,
                    outlet: menuitem.outlet,
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
        if (Object.hasOwn(this.#sources, name)) {
            throw new Error(`Menu source '${name}' is already registered.`);
        }        
        if (!source || typeof source.resolve !== "function") {
            throw new Error(`Menu source '${name}' must provide a resolve() function.`);
        }        
        this.#sources[name] = source;
        // refresh every effective copy backed by this source
        source.refresh = () => {
            let changed = false;
            for (const target of [...this.#sourceTargets.values()]) {
                if (target.name !== name || !this.#sourceTargets.has(target.children)) continue;
                const items = this.#resolveSourceChildren(target);
                const definition = JSON.stringify(items);
                if (definition === target.definition) continue;

                // Keep a static item's descendants registered when only its inferred order changes.
                const previous = new Map(target.items.map(({ item }, index) => [item, target.children[index]]));
                const targets = new Map();
                const children = items.map(entry => {
                    const { item, order } = entry;
                    const child = previous.get(item);
                    if (!child) return this.#cloneMenuitem(entry, target.area, targets);
                    previous.delete(item);
                    return child.order === order ? child : Object.freeze({ ...child, order });
                });
                changed ||= JSON.stringify(target.children) !== JSON.stringify(children);
                this.#removeSourceTargets(previous.values());
                target.children.splice(0, target.children.length, ...children);
                for (const [collection, nested] of targets) this.#sourceTargets.set(collection, nested);
                target.items = items;
                target.definition = definition;
            }
            return changed;
        };
        for (const event of source.dependsOn || []) {
            this.#bus.addEventListener(event, () => {
                if (source.refresh()) this.#bus.emit("xshell:menus:change", {});
            });
        }
    }
    // methods (private)
    #mergeMenuDefinition(previous = { items: [] }, contribution, moduleId) {
        // Keep omitted metadata and merge the static items using the existing contribution order.
        const { label = previous.label, description = previous.description, icon = previous.icon, items } = contribution;
        return { label, description, icon, items: items ? this.#mergeMenuitems(previous.items, items, moduleId) : previous.items };
    }
    #createMenuDefinition(name, definition, area = null) {
        // Apply defaults only after composition and project the effective item hierarchy.
        const { label = name, description = "", icon = null, items } = definition;
        return Object.freeze({
            name, scope: area ? "area" : "global", label, description, icon,
            items: Object.freeze(this.#sortMenuitems(items).map(entry => this.#cloneMenuitem(entry, area)))
        });
    }
    #resolveMenuSource(source, name, moduleId, area) {
        // Inventory sources use the owning module's generated file list.
        if (source.startsWith("/")) {
            const { files, label } = this.#config.modules[moduleId];
            return this.#createMenuFromModuleFiles(files, source, label, [".js", ".html", ".md"], true);
        }
        // Registered menu sources contribute root items during initialization.
        if (!Object.hasOwn(this.#sources, source)) {
            throw new Error(`Module '${moduleId}' menu '${name}' references unregistered menu source '${source}'.`);
        }
        const items = this.#sources[source].resolve() || [];
        if (!Array.isArray(items)) {
            throw new Error(`Menu source '${source}' for Area '${area.id}', module '${moduleId}', menu '${name}' must resolve to an array.`);
        }
        return items;
    }
    #sortMenuitems(items) {
        // Group unanchored contributions into the opening block and keep anchored runs together.
        const opening = { order: 0, entries: [] };
        const blocks = [opening];
        const itemBlocks = [];
        for (const item of items) {
            let block = itemBlocks[item[previousMenuitemIndex]] ?? opening;
            if (typeof item.order === "number") {
                block = { order: item.order, entries: [] };
                blocks.push(block);
            }
            itemBlocks.push(block);
            block.entries.push({ item, order: block.order + block.entries.length });
        }
        return blocks.sort((a, b) => a.order - b.order).flatMap(block => block.entries);
    }
    #mergeMenuitems(target, source, moduleId) {
        // The target has already been merged. Match only the first position in this array.
        const result = [...target];
        const indexes = new Map();
        const getId = item => typeof item?.id === "string" && item.id ? item.id : null;
        for (const [index, item] of result.entries()) {
            const id = getId(item);
            if (id !== null) indexes.set(id, index);
        }
        // Link new items within a contribution. Updates to an existing ID only restart the link when they set an order.
        let previousIndex;
        for (const item of source) {
            const id = getId(item);
            const index = indexes.get(id) ?? result.length;
            const isNew = index === result.length;
            if (id !== null) indexes.set(id, index);
            const merged = this.#mergeMenuitemValue(result[index], item, moduleId);
            if (moduleId !== undefined && isNew && previousIndex !== undefined) merged[previousMenuitemIndex] = previousIndex;
            result[index] = merged;
            if (isNew || typeof item?.order === "number") previousIndex = index;
        }
        return result;
    }
    #mergeMenuitemValue(previous, value, moduleId) {
        // Merge raw properties so projection defaults cannot overwrite an omitted field.
        if (Array.isArray(value)) return this.#mergeMenuitems(Array.isArray(previous) ? previous : [], value, moduleId);
        if (value === null || typeof value !== "object") return value;
        const base = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
        const properties = Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key, this.#mergeMenuitemValue(Object.hasOwn(base, key) ? base[key] : undefined, entry, key === "children" ? moduleId : undefined)
        ]));
        const item = { ...base, ...properties };
        if (moduleId !== undefined) {
            // The contributor of the winning href owns the target. The children source has its own owner.
            item.module = !base.href || Object.hasOwn(value, "href") ? moduleId : base.module;
            item.childrenSourceModule = Object.hasOwn(value, "childrenSource") ? moduleId : base.childrenSourceModule;
        }
        return item;
    }
    #cloneMenuitem({ item: menuitem, order }, area = null, sourceTargets = this.#sourceTargets) {
        // Global menus are composed before runtime sources are registered.
        if (!area && menuitem.childrenSource !== undefined) {
            throw new Error(`Global menu item '${menuitem.id ?? menuitem.label}' from module '${menuitem.childrenSourceModule}' ` +
                `must use static children. Children source '${menuitem.childrenSource}' is unsupported.`);
        }

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
            ...(menuitem.description !== undefined ? { description: menuitem.description } : {}),
            order,
            href: area ? this.#buildAreaHref(menuitem.href, area) : menuitem.href,
            path: area ? this.#buildAreaHref(menuitem.path, area) : menuitem.path,
            command: menuitem.command ?? null,
            icon: menuitem.icon ?? null,
            open: menuitem.open ?? null,
            outlet: menuitem.outlet ?? null,
            tooltip: menuitem.tooltip ?? null,
            default: menuitem.default ?? false,
            class: menuitem.class ?? "",
            module: moduleId,
            ...(area ? { area: area.id } : {}),
            children: []
        };
        const staticItems = menuitem.children || [];
        if (area && menuitem.childrenSource) {
            const name = menuitem.childrenSource;
            const sourceModule = menuitem.childrenSourceModule;
            if (!Object.hasOwn(this.#sources, name)) {
                throw new Error(`Module '${sourceModule}' menu item '${label}' references unregistered children source '${name}'.`);
            }
            const target = { name, moduleId: sourceModule, area, staticItems, children: result.children };
            const items = this.#resolveSourceChildren(target);
            result.children.push(...items.map(entry => this.#cloneMenuitem(entry, area, sourceTargets)));
            target.items = items;
            target.definition = JSON.stringify(items);
            sourceTargets.set(result.children, target);
        } else {
            result.children = Object.freeze(this.#sortMenuitems(staticItems).map(entry => this.#cloneMenuitem(entry, area, sourceTargets)));
        }
        return Object.freeze(result);
    }
    #resolveSourceChildren({ name, moduleId, staticItems }) {
        // Reapply the current source results to the unchanged static definitions on every refresh.
        const items = this.#sources[name].resolve() || [];
        if (!Array.isArray(items)) throw new Error(`Children source '${name}' from module '${moduleId}' must resolve to an array.`);
        return this.#sortMenuitems(this.#mergeMenuitems(staticItems, items, moduleId));
    }
    #removeSourceTargets(items) {
        // Forget descendants of replaced children so later refreshes only visit live collections.
        for (const item of items) {
            this.#sourceTargets.delete(item.children);
            this.#removeSourceTargets(item.children);
        }
    }
    #buildAreaHref(href, area) {
        if (!href) return null;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        const path = href.startsWith("/") ? href : "/" + href;
        if (area.prefix && (path === area.prefix || path.startsWith(area.prefix + "/"))) return path;
        return area.prefix + path;
    }
    #getHrefIdentity(href) {
        if (!href) return href;
        const queryIndex = href.indexOf("?");
        const hashIndex = href.indexOf("#");
        const suffixIndexes = [queryIndex, hashIndex].filter(index => index !== -1);
        return suffixIndexes.length ? href.substring(0, Math.min(...suffixIndexes)) : href;
    }
    #setCurrentArea(areaId) {
        if (this.#currentAreaId === areaId) return;
        const area = this.getArea(areaId);
        if (!area) throw new Error(`Unknown area '${areaId}'`);
        this.#currentAreaId = areaId;
        this.#bus.emit("xshell:area:change", { areaId });
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
    #normalizeAreaPrefix(prefix) {
        if (!prefix || prefix === "/") return "";
        return "/" + prefix.replace(/^\/+|\/+$/g, "");
    }
    #createMenuFromModuleFiles(files, root, rootItemLabel, extensions, createPaths) {
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
                    ...(createPaths ? { path: createPath(pathParts) } : {}),
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
