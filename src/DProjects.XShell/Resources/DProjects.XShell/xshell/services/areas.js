import { matchesPathPrefix, normalizeUrlPrefix } from "../utils/urls.js";
import { compileRoute } from "../utils/route.js";

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
                        menus: { type: "object", additionalProperties: { type: "string", minLength: 1 }, description: "Menu slots mapped to named definitions." },
                        routes: { type: "object", additionalProperties: { type: "string", minLength: 1 }, description: "Area-relative route patterns mapped to Page targets." },
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

        // Validate the default Area and the ownership boundaries of configured prefixes.
        if (defaultAreaId !== null && !Object.hasOwn(definitions, defaultAreaId)) throw new Error(`Default area '${defaultAreaId}' is not defined.`);
        const prefixes = new Map();
        for (const [areaId, area] of Object.entries(definitions)) {
            const prefix = this.#normalizeAreaPrefix(area.prefix);
            if (prefix && conflictsWithGlobal(prefix)) {
                throw new Error(`Navigation globalPrefix '${this.#globalPrefix}' conflicts with Area '${areaId}' prefix '${prefix}'.`);
            }
            if (prefixes.has(prefix)) throw new Error(`Areas '${prefixes.get(prefix)}' and '${areaId}' have duplicate normalized prefix '${prefix}'.`);
            prefixes.set(prefix, areaId);
        }

        // Validate configured routes before publishing their descriptors or starting module controllers.
        const inventories = [["xshell", config.xshell], ...Object.entries(config.modules)];
        const areas = [];
        for (const [areaId, areaConfig] of Object.entries(definitions)) {
            const { home, routes: configuredRoutes, ...options } = areaConfig;
            const routes = Object.freeze(Object.entries(configuredRoutes || {}).map(([path, href]) => {
                try {
                    compileRoute(path);
                } catch (cause) {
                    throw new Error(`Area '${areaId}' declares invalid route '${path}': ${cause.message}`, { cause });
                }
                // Identify canonical asset targets, including paths already qualified by an Area prefix.
                const identity = href.split(/[?#]/, 1)[0];
                const assetIndex = identity.indexOf(this.#assetsBasePath + "/");
                const resource = assetIndex === 0 || (assetIndex > 0 && prefixes.has(identity.slice(0, assetIndex))) ? identity.slice(assetIndex) : "";
                const module = inventories.find(([, { assets }]) => assets?.path && resource.startsWith(assets.path + "/"))?.[0] ?? null;
                return Object.freeze({ path, href, module });
            }));
            // Publish the navigation context, with its home derived after Menus initializes.
            areas.push({
                ...options,
                id: areaId,
                label: areaConfig.label || areaId,
                icon: areaConfig.icon || null,
                prefix: this.#normalizeAreaPrefix(areaConfig.prefix),
                order: areaConfig.order || 0,
                default: areaId === defaultAreaId,
                menus: Object.freeze({ ...areaConfig.menus }),
                get routes() { return routes; },
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
    init({ menus }) {
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
        // Use the effective navigation menu for each Area home.
        for (const area of this.#areas) {
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
