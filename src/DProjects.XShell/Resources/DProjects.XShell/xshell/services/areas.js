import { matchesPathPrefix, normalizeUrlPrefix } from "../utils/urls.js";

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
                        menus: { type: "object", additionalProperties: { type: "string", minLength: 1 }, description: "Menu slots mapped to named definitions." },
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
    #bus = null;
    #areas = [];
    #assetsBasePath = null;
    #globalPrefix = null;
    #currentAreaId = null;

    // ctor
    constructor({ config, bus }, options = {}) {
        // initialize injected dependencies and Area configuration
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
                menus: Object.freeze({ ...areaConfig.menus }),
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
    init({ modules, menus }) {
        // derive Area homes from the configured navigation slot
        const findDefaultHref = (items) => {
            for (const item of items || []) {
                if (item.default) return item.path || item.href || null;
                const href = findDefaultHref(item.children);
                if (href) return href;
            }
            return null;
        };
        const findFirstHref = (items) => {
            for (const item of items || []) {
                const href = item.path || item.href;
                if (href) return href;

                const childHref = findFirstHref(item.children);
                if (childHref) return childHref;
            }
            return null;
        };
        // Compose routes from participating modules and use the effective navigation menu for the Area home.
        for (const area of this.#areas) {
            const routes = [];
            for (const moduleId of area.modules) {
                const module = modules.getModuleById(moduleId);
                if (!module) throw new Error(`Area '${area.id}' references unknown module '${moduleId}'.`);
                for (const [path, href] of Object.entries(module.routes || {})) {
                    routes.push(Object.freeze({ path, href, module: module.id }));
                }
            }
            area.routes = Object.freeze(routes);
            const navigation = menus.getMenu("navigation", area.id);
            const items = navigation?.scope === "area" ? navigation.items : [];
            area.home = findDefaultHref(items) || findFirstHref(items);
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
        const path = href.split(/[?#]/, 1)[0];
        if (matchesPathPrefix(path, this.#globalPrefix)) return null;
        // longest matching navigation prefix wins
        const areas = [...this.#areas].sort((a, b) => b.prefix.length - a.prefix.length);
        for (const area of areas) {
            if (matchesPathPrefix(path, area.prefix) || (!area.prefix && path.startsWith("/"))) return area.id;
        }
        return null;
    }
    getModuleId(href) {
        const assetsIndex = href.lastIndexOf(this.#assetsBasePath + "/");
        return assetsIndex === -1 ? null : href.substring(assetsIndex + this.#assetsBasePath.length + 1).split("/")[0] || null;
    }

    // methods (private)
    #setCurrentArea(areaId) {
        if (this.#currentAreaId === areaId) return;
        const area = this.getArea(areaId);
        if (!area) throw new Error(`Unknown area '${areaId}'`);
        this.#currentAreaId = areaId;
        this.#bus.emit("xshell:area:change", { areaId });
    }
    #normalizeAreaPrefix(prefix) {
        if (!prefix || prefix === "/") return "";
        return "/" + prefix.replace(/^\/+|\/+$/g, "");
    }
}
