import {combineUrls} from "../utils/urls.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64.js";
import { compileRoute } from "../utils/route.js";
import { HASH_PREFIX } from "../utils/urls.js";

function withStackClasses(item, classes) {
    // Snapshot caller classes and keep entries without classes in the existing format.
    const names = Array.isArray(classes) ? classes.filter(name => typeof name === "string" && name.length) : [];
    return names.length ? { ...item, classes: names } : item;
}

// class
export default class Navigation {

    // options
    static optionsSchema = {
        type: "object",
        required: ["mode"],
        properties: {
            mode: {
                type: "string",
                enum: ["hash", "path"],
                description: "Navigation strategy used by the application."
            }
        },
        additionalProperties: false,
        description: "Navigation service configuration."
    };

    // vars
    #areas = null;
    #bus = null;
    #config = null;
    #container = null;
    #resolver = null;

    #mode = "";
    #appBasePath = "";
    #assetsBasePath = "";
    #compiledRoutes = new Map();

    #stack = [];
    #stackToDomTask = Promise.resolve();
    
    // ctor
    constructor( { areas, bus, config, resolver }, options = {}, { container = document.body } = {} ) {
        // initialize injected dependencies
        this.#areas = areas;
        this.#bus = bus;
        this.#config = config;
        this.#resolver = resolver;

        // initialize navigation settings
        this.#mode = options.mode;
        this.#container = container;
        this.#appBasePath = config.app.basePath === "/" ? "" : config.app.basePath;
        this.#assetsBasePath = config.xshell.assets?.basePath || "";
    }

    // props
    get mode() { return this.#mode; }
    get src() { 
        if (!this.#stack.length) return null;
        this.#stack[0].href;
        let xpage = this.getXPage();
        return (xpage ? xpage.src : null);
    }
    get stack() {
        return this.#stack.map(p => Object.freeze({
            href: p.href,
            params: p.params,
            nav: p.nav,
            ...(p.classes ? { classes: Object.freeze([...p.classes]) } : {})
        }))
    }
    
    // init
    async init() {
        if (this.#mode == "hash") {
            // hash mode
            window.addEventListener("hashchange", async () => {
                this.#stack = this.#browserUrlToStack(document.location.hash);
                await this.#stackToDom();
            });
            // init
            if (document.location.hash) {
                this.#stack = this.#browserUrlToStack(document.location.hash);
                await this.#stackToDom();
            } else {
                let defaultArea = this.#areas.getDefaultArea();
                if (!defaultArea?.home) throw new Error("Default area has no navigation item marked default");
                await this.#stackToBrowser([this.parseUrl(defaultArea.home)], { replace: false });
            }
        } else if (this.#mode == "path") {
            // path mode
            window.addEventListener("popstate", async () => {
                let url = document.location.pathname + document.location.search;
                if (url.startsWith(this.#appBasePath)) url = url.substring(this.#appBasePath.length);
                this.#stack = this.#browserUrlToStack(url + document.location.hash);
                await this.#stackToDom();
            });
            // init
            let url = document.location.pathname + document.location.search;
            if (url.startsWith(this.#appBasePath)) url = url.substring(this.#appBasePath.length);
            if (url != "" && url != "/") {
                this.#stack = this.#browserUrlToStack(url + document.location.hash);
                await this.#stackToDom();
            } else {
                let defaultArea = this.#areas.getDefaultArea();
                if (!defaultArea?.home) throw new Error("Default area has no navigation item marked default");
                url = this.parseUrl(defaultArea.home);
                await this.#stackToBrowser([url], { replace: false });
            }
        }
    }

    // methods
    getXPage() {
        // get the first page that is a direct child of the container and not a dialog
        return this.getXPages()[0];
    }
    getXPages() {
        // get pages that are direct children of the container and not dialogs
        return Array.from(this.#container.querySelectorAll(":scope > x-page:not([layout='dialog'])"));
    }
    getXPageFromElement(target) {
        // get the page element from a target element by traversing up the DOM tree
        while (target) {
            if (!target.parentNode) {
                target = target.host;
            }
            if (!target) {
                return null;
            }
            if (target.localName == "x-page") return target;
            target = target.parentNode;
        }
        return null;
    }
    replacePageQuery(page, changes) {
        // patch one Page query and replace the browser URL when the Page is in the stack
        if (!changes || typeof(changes) !== "object" || Array.isArray(changes)) {
            throw new TypeError("Navigation.replacePageQuery: changes must be an object.");
        }
        const xpage = page?.host || null;
        const xpages = xpage ? this.getXPages() : [];
        const index = xpages.indexOf(xpage);
        if (index < 0 || index >= this.#stack.length) {
            return this.#replacePageSrcQuery(page?.src || null, changes);
        }
        const item = this.#stack[index];
        const params = { ...(item.params || {}) };
        this.#applyQueryChanges(params, changes);
        const stack = [...this.#stack];
        stack[index] = { ...item, params };
        this.#stackToBrowser(stack, { replace: true });
        return this.#buildUrlFinal(stack[index]);
    }
    replacePageHash(page, hash) {
        // replace one Page fragment without navigating or reloading the Page
        if (hash !== null && typeof(hash) !== "string") {
            throw new TypeError("Navigation.replacePageHash: hash must be a string or null.");
        }
        const fragment = hash ? `#${hash.replace(/^#+/, "")}` : "";
        const xpage = page?.host || null;
        const xpages = xpage ? this.getXPages() : [];
        const index = xpages.indexOf(xpage);
        if (index < 0 || index >= this.#stack.length) {
            return this.#replacePageSrcHash(page?.src || null, fragment);
        }
        const item = this.#stack[index];
        const stack = [...this.#stack];
        stack[index] = { ...item, href: this.#replacePageSrcHash(item.href, fragment) };
        this.#stackToBrowser(stack, { replace: true });
        return this.#buildUrlFinal(stack[index]);
    }
    buildUrlAbsolute(params){
        let href = this.#buildUrlPublic(params);
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        if (this.#mode == "hash") {
            href = this.#appBasePath + "/" + HASH_PREFIX + href;
        } else {
            href = this.#appBasePath + href;
        }
        return href;
    }
    buildUrl({
            href,           // url relative to app base
            params = {},    // ws variables to be added as query string parameters
            nav = {              // navigation data to be added as query string parameters (nav.title, nav.icon, nav.breadcrumb)
                title: null,      // nav.title
                description: null,// nav.description
                icon: null,       // nav.icon
                breadcrumb: null},// nav.breadcrumb
            page,           // current page element for resolving relative urls
        }) {
        // produces real, navigable URLS
        if (!href || typeof href !== "string") throw new Error("buildUrl: href must be a non-empty string");
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        if (href.startsWith("#!")) href = href.substring(2);
        // resolve relative urls
        if (!href.startsWith("/")) href = combineUrls(page ? page.src : "/", href);
        // params
        for (const [k, v] of Object.entries(params)) {
            href = this.#appendQueryParameter(href, encodeURIComponent(k), encodeURIComponent(v));
        }    
        // nav
        if (nav && (nav.title || nav.description || nav.icon || nav.breadcrumb)) {
            const navJson = JSON.stringify(nav, (key, value) => {
                if (value !== null) return value;
                return undefined;
            });
            href = this.#appendQueryParameter(href, "nav", base64UrlEncode(navJson));
        }
        // return
        return href;
    }
    parseUrl(url) {
        if (!url || typeof url !== "string") throw new Error("parseUrl: url must be a non-empty string");
        // remove hash prefix if present (#!)
        if (url.startsWith("#!")) url = url.substring(2);
        // separate path, query and fragment while retaining the fragment as part of the logical href
        const hashIndex = url.indexOf("#");
        const fragment = hashIndex === -1 ? "" : url.substring(hashIndex);
        const source = hashIndex === -1 ? url : url.substring(0, hashIndex);
        const queryIndex = source.indexOf("?");
        const pathPart = queryIndex === -1 ? source : source.substring(0, queryIndex);
        const queryPart = queryIndex === -1 ? "" : source.substring(queryIndex + 1);
        const result = {
            href: (pathPart || "") + fragment,
            params: {},
            nav: {
                title: null,
                description: null,
                icon: null,
                breadcrumb: null
            }
        };
        if (!queryPart) return result;
        const searchParams = new URLSearchParams(queryPart);
        for (const [key, value] of searchParams.entries()) {
            if (key === "nav") {
                try {
                    const json = base64UrlDecode(value);
                    result.nav = JSON.parse(json);
                } catch {
                    result.nav = {
                        title: null,
                        description: null,
                        icon: null,
                        breadcrumb: null
                    };
                }
            } else {
                result.params[key] = value;
            }
        }
        return result;
    }
    resolveRoute(path) {
        // inspect configured routes from a logical application path without navigating
        if (typeof path !== "string" || !path.trim()) throw new Error("resolveRoute: path must be a non-empty string");
        if (!path.startsWith("/") || path.startsWith("//")) throw new Error("resolveRoute: path must start with a single '/'");
        const item = this.parseUrl(path);
        const match = this.#findRouteMatch(this.#splitHref(item.href).identity);
        if (!match) return null;

        // describe the first match and build the same logical Page href used during navigation
        const { area, route, params } = match;
        return {
            areaId: area.id,
            areaPrefix: area.prefix,
            moduleId: route.module,
            route: route.path,
            target: route.href,
            params,
            href: this.#buildRouteHref(match, item, area)
        };
    }

    async navigate({
            href,
            params = {},    // variables to be added as query string parameters
            nav = {         // navigation data to be added as query string parameters (nav.title, nav.icon, nav.breadcrumb)
                title: null,      // nav.title
                description: null,// nav.description
                icon: null,       // nav.icon
                breadcrumb: null},// nav.breadcrumb
            page,
            outlet,         // target outlet for embed mode (outlet name or element)
            open = "auto",  // auto | top | stack | dialog | embed 
            context = {},   // additional context to be passed to the page (e.g. dialog parameters)
            classes,        // caller presentation classes for a stacked Page
            replace = false
        }) {
        // Preserve explicit asset targets for embeds while retaining ordinary relative resolution.
        if (!open) open = "auto";
        const preserveAssetPath = open === "embed" && (href.startsWith("/") || href.startsWith(HASH_PREFIX + "/") || href.startsWith("page:"));
        const hrefResolved = this.#resolveCanonicalHref(href, page, { preserveAssetPath });
        const hrefAbsolute = this.buildUrl({ href: hrefResolved, params, nav, page });
        // open
        if (open == "auto") {
            // auto
            const xpage = page.host;
            const xpages = this.getXPages();
            const indexPage = xpages.indexOf(xpage);
            if  (xpage == null) {
                // top
                await this.#stackToBrowser([ this.parseUrl(hrefAbsolute) ], { replace });
            } else if (indexPage == 0) {
                // top
                await this.#stackToBrowser([ this.parseUrl(hrefAbsolute) ], { replace });
            } else if (indexPage != -1) {
                // stackpage
                let stack = [...this.#stack];
                stack[indexPage] = withStackClasses(this.parseUrl(hrefAbsolute), classes);
                await this.#stackToBrowser(stack, { replace });
            } else {
                // dialog or embed 
                const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute));
                xpage.setAttribute("src", hrefFinal);
            }
        } else if (open == "top") {
            // top                        
            await this.#stackToBrowser([ this.parseUrl(hrefAbsolute) ], { replace });

        } else if (open == "stack") {
            // stack
            await this.#stackToBrowser([...this.#stack, withStackClasses(this.parseUrl(hrefAbsolute), classes)], { replace });
            
        } else if (open == "dialog") {
            // dialog
            const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute));
            return await this.#showDialog({ href: hrefFinal, context });

        } else if (open == "embed") {
            // embed
            if (typeof outlet === "string") {
                const xpage = page.host;
                const outletElement = xpage.querySelector(`x-page[outlet="${outlet}"]`);
                if (outletElement) {
                    const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute), { preserveAssetPath });
                    outletElement.setAttribute("src", hrefFinal);
                }
            }
        } else if (open == "dock") {
            // stack
            this.#bus.emit("xshell:navigation:dock:changed", {
                src: hrefAbsolute,
            });
        }  
    }


    // private methods
    #stackToBrowser(stack, { replace }) {
        let url = "";
        if (stack.length) {
            // root page
            const root = stack[0];
            url = this.#buildUrlPublic({
                href: root.href,
                params: root.params,
                nav: (stack.length == 1 ? root.nav : null)
            })
            // Store the root navigation metadata and the child entries, including their presentation classes.
            if (stack.length > 1) {
                let aux = {};
                aux.title = root.nav.title;
                aux.description = root.nav.description;
                aux.icon = root.nav.icon;
                aux.breadcrumb = root.nav.breadcrumb;
                aux.stack = stack.slice(1);
                const navJson = JSON.stringify(aux, (key, value) => {
                    if (value !== null) return value;
                    return undefined;
                });
                url = this.#appendQueryParameter(url, "nav", base64UrlEncode(navJson));
            }
        }
        this.#stack = stack;
        if (this.#mode === "hash") {
            if (replace) {
                location.replace(HASH_PREFIX + url);
            } else {
                location.hash = HASH_PREFIX + url;
            }            
        } else if (this.#mode === "path") {
            if (replace) {
                history.replaceState(null, "", this.#appBasePath + url);
            } else {
                history.pushState(null, "", this.#appBasePath + url);
            }
        }
        // keep the live Page elements and the logical stack aligned without reloading href-identical Pages
        return this.#stackToDom();
    }
    #browserUrlToStack(url) {
        if (!url || typeof url !== "string") {
            throw new Error("_browserUrlToStack: url must be a non-empty string");
        }
        // remove hash prefix if needed
        if (this.#mode === "hash") {
            if (url.startsWith(HASH_PREFIX)) {
                url = url.substring(HASH_PREFIX.length);
            }
        } 
        // Restore child entries from the same fragment-aware parse as the root Page.
        const { href, params, nav } = this.parseUrl(url);
        const { title, description, icon, breadcrumb, stack: children } = nav ?? {};
        const stack = [{ href, params, nav: { title, description, icon, breadcrumb } }];
        if (Array.isArray(children)) {
            for (const { classes, ...item } of children) stack.push(withStackClasses(item, classes));
        }
        return stack;
    }
    #stackToDom() {
        // serialize reconciliations so a pending Page unload cannot be selected again
        const task = this.#stackToDomTask.then(() => this.#reconcileStackToDom());
        this.#stackToDomTask = task.then(() => {}, () => {});
        return task;
    }
    async #reconcileStackToDom() {
        //navigate
        const xpages = this.getXPages();
        const domStack = xpages.map(xpage => this.parseUrl(xpage.src));

        // Detect structural navigation, ignoring query parameters and URL fragments.
        const structuralChange = domStack.length !== this.#stack.length ||
            domStack.some((before, index) => {
                const targetHref = this.parseUrl(this.#buildUrlFinal(this.#stack[index])).href;
                return this.#splitHref(before.href).identity !== this.#splitHref(targetHref).identity;
            });

        // Close dialogs only when the navigation stack changes structurally.
        if (structuralChange) {
            const allXPages = Array.from(this.#container.querySelectorAll(":scope > x-page"));
            for (let i = allXPages.length - 1; i >= 0; i--) {
                const xpage = allXPages[i];
                if (xpage.getAttribute("layout") !== "dialog") break;
                xpage.close();
            }
        }

        //process stack
        for (let i = 0; i < Math.max(this.#stack.length, domStack.length); i++) {
            let itemBefore = domStack[i];
            let itemAfter = this.#stack[i];
            if (!itemBefore && itemAfter) {
                //add page
                let xpage = document.createElement("x-page");
                const hrefFinal = this.#buildUrlFinal(itemAfter);
                xpage.setAttribute("src", hrefFinal);
                if (i == 0) {
                    xpage.setAttribute("layout", "main");
                    //emit event navigation-start
                    this.#bus.emit("xshell:navigation:start", { src: xpage.src });
                } else {
                    xpage.setAttribute("layout", "stack");
                    xpage.stackClasses = itemAfter.classes;
                    xpage.addEventListener("close", async (event) => {
                        //page close
                        let xpages = this.getXPages();
                        let index = xpages.indexOf(event.target);
                        this.#stack.splice(index, 1);
                        await this.#stackToBrowser(this.#stack, { replace: false });
                    });
                }
                xpage.addEventListener("change", (event) => {
                    //page change
                    let xpages = this.getXPages();
                    if (xpages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this.#config.app.label;
                    }
                });
                xpage.addEventListener("load", (event) => {
                    //page load
                    let xpages = this.getXPages();
                    if (xpages.indexOf(event.target) == 0) {
                        var label = event.target.label;
                        if (label) document.title = label + " / " + this.#config.app.label;
                        this.#bus.emit("xshell:navigation:end", { src: event.target.src, id: event.target.page.id});
                    }
                });
                xpage.addEventListener("first-render", event => {
                    // Forward the first render of the main Page
                    if (this.getXPages()[0] !== event.target) return;
                    this.#bus.emit("xshell:navigation:first-render", {
                        src: event.target.src,
                        id: event.detail.page.id
                    });
                }, { once: true });
                //add page to container
                this.#container.appendChild(xpage);
            } else if (itemBefore && !itemAfter) {
                //remove page
                // use the original host for this position and await its final cleanup
                await xpages[i].removePage();
            } else {
                // Apply presentation updates even when the existing Page can stay mounted.
                const xpage = xpages[i];
                if (i > 0) xpage.stackClasses = itemAfter.classes;
                if (itemBefore.href === itemAfter.href) continue;

                //change page
                const hrefFinal = itemAfter ? this.#buildUrlFinal(itemAfter) : null;
                const itemFinal = hrefFinal ? this.parseUrl(hrefFinal) : null;
                if (itemBefore.href != itemFinal.href) {
                    xpage.src = hrefFinal;
                    //emit event navigation-start
                    if (i == 0) {
                        this.#bus.emit("xshell:navigation:start", { src: xpage.src });
                    }
                }
            }
        }
    }
    async #showDialog({ href, context }) {
        //show page dialog
        let xpage = document.createElement("x-page");
        const hrefFinal = this.#buildUrlFinal(this.parseUrl(href));
        xpage.setAttribute("src", hrefFinal);
        xpage.setAttribute("layout", "dialog");
        xpage.context = context || {};
        return new Promise((resolve, reject) => {
            let closing = false;
            xpage.addEventListener("close", async () => {
                if (closing) return;
                closing = true;
                try {
                    // preserve the result before final Page destruction clears the Page reference
                    const result = xpage.result;
                    await xpage.removePage();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.#container.appendChild(xpage);
        });
    }
    #buildUrlFinal(item, { preserveAssetPath = false } = {}) {
        const { identity, suffix } = this.#splitHref(item.href);

        // Keep explicit embedded resources out of friendly menu and route matching.
        if (preserveAssetPath) {
            const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
            if (this.#isAssetPath(identity) || this.#isAssetPath(this.#removeAreaPrefix(identity, area))) return this.buildUrl(item);
        }
        const menuitem = this.#areas.resolvePath(identity);
        if (menuitem) {
            return this.buildUrl({
                ...item,
                href: menuitem.href + suffix
            });
        }
        const match = this.#findRouteMatch(identity);
        if (match) return this.#buildRouteHref(match, item, match.area);
        return this.buildUrl({
            ...item,
            href: identity + suffix
        });
    }
    #buildUrlPublic(params) {
        const target = this.#resolvePublicTarget(params.href, params.params || {}, params.page);
        return this.buildUrl({ ...params, href: target.href, params: target.params });
    }
    #resolvePublicHref(href, page) {
        return this.#resolvePublicTarget(href, {}, page).href;
    }
    #resolvePublicTarget(href, params, page) {
        // leave external targets under native browser control
        if (!href.startsWith("page:") && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return { href, params };
        const canonicalHref = this.#resolveCanonicalHref(href, page);
        const { identity, suffix } = this.#splitHref(canonicalHref);
        const areaId = this.#areas.resolveAreaId?.(identity);
        const area = this.#areas.getArea?.(areaId);
        const menuitem = area ? this.#areas.resolveHref?.(identity, area.id) : null;
        if (menuitem) return { href: (menuitem.path || identity) + suffix, params };
        for (const routeArea of this.#getPublicRouteAreas(href.startsWith("page:") ? canonicalHref : href, page)) {
            const routeTarget = this.#resolvePublicRouteTarget(canonicalHref, params, routeArea);
            if (routeTarget) return routeTarget;
        }
        return { href: canonicalHref, params };
    }
    #resolveCanonicalHref(href, page, { preserveAssetPath = false } = {}) {
        // resolve relative targets and apply the originating navigation context
        if (href.startsWith("page:")) {
            const { identity, suffix } = this.#splitHref(href);
            const resolved = this.#resolver.resolve(identity);
            if (!resolved?.path) throw new Error(`Navigation: unable to resolve Page reference '${identity}' to a browser path.`);
            href = resolved.path + suffix;
        }
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return href;
        if (href.startsWith("#!")) href = href.substring(2);
        href = this.#removeAppBasePathFromAssetHref(href);
        if (!href.startsWith("/")) href = combineUrls(page ? page.src : "/", href);
        const { identity, suffix } = this.#splitHref(href);
        const targetArea = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
        if (targetArea?.prefix) return identity + suffix;

        // Preserve an explicit canonical asset path before looking up the originating Area or menu.
        if (preserveAssetPath && this.#isAssetPath(identity)) return identity + suffix;
        const pageAreaId = page?.src ? this.#areas.resolveAreaId?.(page.src) : null;
        const menuitem = this.#areas.resolveHref?.(identity, pageAreaId) || this.#areas.resolveHref?.(identity);
        if (menuitem) return menuitem.href + suffix;
        const area = page ? this.#areas.getArea?.(pageAreaId) : this.#areas.getCurrentArea?.() || this.#areas.getDefaultArea?.();
        if (!area) return href;
        const canonicalHref = this.#applyAreaPrefix(identity, area);
        return canonicalHref + suffix;
    }
    #findRouteMatch(identity) {
        // select the Area from the public path and match against Area-relative declarations
        const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
        if (!area) return null;
        const match = this.#matchAreaRoutes(this.#removeAreaPrefix(identity, area), area);
        return match ? { area, ...match } : null;
    }
    #compileRoute(path) {
        return compileRoute(path);
    }
    #matchAreaRoutes(path, area) {
        return this.#matchRoutes(path, area?.routes || []);
    }
    #matchRoutes(path, routes) {
        if (typeof path !== "string") throw new TypeError("matchRoutes: path must be a string");
        const pathname = this.#splitHref(path).identity;
        for (const route of routes || []) {
            const compiled = this.#getCompiledRoute(route.path);
            const match = compiled.matcher.exec(pathname);
            if (!match) continue;
            const params = {};
            for (let index = 0; index < compiled.parameters.length; index++) {
                try {
                    params[compiled.parameters[index]] = decodeURIComponent(match[index + 1]);
                } catch (error) {
                    throw new Error(`Invalid encoded route parameter in path '${path}'.`, { cause: error });
                }
            }
            return { route, params };
        }
        return null;
    }
    #getCompiledRoute(path) {
        let compiled = this.#compiledRoutes.get(path);
        if (!compiled) {
            compiled = this.#compileRoute(path);
            this.#compiledRoutes.set(path, compiled);
        }
        return compiled;
    }
    #buildRouteHref(match, item, area) {
        // merge the route target and incoming URL while keeping path parameters authoritative
        const target = this.parseUrl(match.route.href);
        const targetParts = this.#splitHref(target.href);
        const inputParts = this.#splitHref(item.href);
        const targetIdentity = this.#applyAreaPrefix(targetParts.identity, area);
        const params = { ...target.params, ...match.params };
        for (const [key, value] of Object.entries(item.params || {})) {
            if (!Object.hasOwn(match.params, key)) params[key] = value;
        }
        return this.buildUrl({
            ...item,
            href: targetIdentity + (inputParts.suffix || targetParts.suffix),
            params
        });
    }
    #getPublicRouteAreas(href, page) {
        const areas = [];
        const add = area => {
            if (area && !areas.includes(area)) areas.push(area);
        };
        const identity = this.#splitHref(href).identity;
        add(this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity)));
        if (page?.src) add(this.#areas.getArea?.(this.#areas.resolveAreaId?.(page.src)));
        const moduleId = this.#areas.getModuleId?.(identity);
        if (moduleId) {
            for (const area of this.#areas.getAreas?.() || []) {
                if (area.modules.includes(moduleId)) add(area);
            }
        }
        add(this.#areas.getCurrentArea?.());
        add(this.#areas.getDefaultArea?.());
        return areas;
    }
    #resolvePublicRouteTarget(canonicalHref, suppliedParams, area) {
        const canonical = this.parseUrl(canonicalHref);
        const canonicalParts = this.#splitHref(canonical.href);
        const canonicalArea = this.#areas.getArea?.(this.#areas.resolveAreaId?.(canonicalParts.identity));
        const canonicalIdentity = this.#removeAreaPrefix(canonicalParts.identity, canonicalArea);
        const canonicalParams = { ...canonical.params, ...suppliedParams };
        for (const route of area.routes || []) {
            const target = this.parseUrl(route.href);
            const targetIdentity = this.#splitHref(target.href).identity;
            if (targetIdentity !== canonicalIdentity) continue;
            let applicable = true;
            for (const [key, value] of Object.entries(target.params)) {
                if (!Object.hasOwn(canonicalParams, key) || String(canonicalParams[key]) !== value) {
                    applicable = false;
                    break;
                }
            }
            if (!applicable) continue;
            const compiled = this.#getCompiledRoute(route.path);
            for (const parameter of compiled.parameters) {
                const value = canonicalParams[parameter];
                if (!Object.hasOwn(canonicalParams, parameter) || value === null || typeof value === "undefined" || String(value) === "") {
                    applicable = false;
                    break;
                }
            }
            if (!applicable) continue;
            const routePath = "/" + compiled.segments.map(segment => Object.hasOwn(segment, "parameter")
                ? encodeURIComponent(String(canonicalParams[segment.parameter]))
                : segment.literal).join("/");
            const remainingParams = { ...canonicalParams };
            for (const key of Object.keys(target.params)) delete remainingParams[key];
            for (const parameter of compiled.parameters) delete remainingParams[parameter];
            const publicPath = this.#applyAreaPrefix(routePath, area);
            return { href: publicPath + canonicalParts.suffix, params: remainingParams };
        }
        return null;
    }
    #removeAreaPrefix(path, area) {
        // derive the Area-relative identity without modifying route declarations
        if (!area?.prefix) return path;
        if (path === area.prefix) return "/";
        return path.startsWith(area.prefix + "/") ? path.substring(area.prefix.length) : path;
    }
    #applyAreaPrefix(path, area) {
        // apply the public navigation context exactly once
        if (!area?.prefix || path === area.prefix || path.startsWith(area.prefix + "/")) return path;
        return area.prefix + path;
    }
    #removeAppBasePathFromAssetHref(href) {
        // Rendered native links may already contain App.BasePath. Convert only
        // structural application asset URLs back to Navigation's logical namespace.
        if (!this.#appBasePath || !this.#assetsBasePath) return href;
        const { identity, suffix } = this.#splitHref(href);
        if (identity !== this.#appBasePath && !identity.startsWith(this.#appBasePath + "/")) return href;
        const applicationIdentity = identity.substring(this.#appBasePath.length) || "/";
        if (this.#isAssetPath(applicationIdentity)) return applicationIdentity + suffix;
        const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(applicationIdentity));
        return this.#isAssetPath(this.#removeAreaPrefix(applicationIdentity, area)) ? applicationIdentity + suffix : href;
    }
    #isAssetPath(path) {
        // Require a namespace boundary so similarly named friendly paths still resolve normally.
        return Boolean(this.#assetsBasePath) && (path === this.#assetsBasePath || path.startsWith(this.#assetsBasePath + "/"));
    }
    #splitHref(href) {
        const queryIndex = href.indexOf("?");
        const hashIndex = href.indexOf("#");
        const suffixIndexes = [queryIndex, hashIndex].filter(index => index !== -1);
        const suffixIndex = suffixIndexes.length ? Math.min(...suffixIndexes) : href.length;
        return { identity: href.substring(0, suffixIndex), suffix: href.substring(suffixIndex) };
    }
    #appendQueryParameter(href, key, value) {
        const hashIndex = href.indexOf("#");
        const fragment = hashIndex === -1 ? "" : href.substring(hashIndex);
        const source = hashIndex === -1 ? href : href.substring(0, hashIndex);
        return source + (source.includes("?") ? "&" : "?") + key + "=" + value + fragment;
    }
    #applyQueryChanges(params, changes) {
        // apply query patches while preserving unrelated parameters
        for (const [key, value] of Object.entries(changes)) {
            if (typeof(value) === "undefined") {
                continue;
            }
            if (value === null) {
                delete params[key];
                continue;
            }
            if (typeof(value) === "number" && !Number.isFinite(value)) {
                throw new TypeError(`Navigation.replacePageQuery: query parameter '${key}' must be finite.`);
            }
            if (!["string", "number", "boolean"].includes(typeof(value))) {
                throw new TypeError(`Navigation.replacePageQuery: query parameter '${key}' must be a scalar, null, or undefined.`);
            }
            params[key] = String(value);
        }
    }
    #replacePageSrcQuery(src, changes) {
        // patch a dialog or embedded Page source without touching browser navigation
        if (typeof(src) !== "string") {
            return null;
        }
        const hashIndex = src.indexOf("#");
        const hash = hashIndex < 0 ? "" : src.substring(hashIndex);
        const source = hashIndex < 0 ? src : src.substring(0, hashIndex);
        const queryIndex = source.indexOf("?");
        const href = queryIndex < 0 ? source : source.substring(0, queryIndex);
        const query = new URLSearchParams(queryIndex < 0 ? "" : source.substring(queryIndex + 1));
        const params = Object.fromEntries(query.entries());
        this.#applyQueryChanges(params, changes);
        const serialized = new URLSearchParams(params).toString();
        return href + (serialized ? `?${serialized}` : "") + hash;
    }
    #replacePageSrcHash(src, hash) {
        // replace only a Page source fragment while preserving its path and query
        if (typeof(src) !== "string") {
            return null;
        }
        const hashIndex = src.indexOf("#");
        return (hashIndex < 0 ? src : src.substring(0, hashIndex)) + hash;
    }
}

