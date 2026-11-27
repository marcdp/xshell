import { combineUrls, HASH_PREFIX, matchesPathPrefix } from "../utils/urls.js";
import { base64UrlEncode, base64UrlDecode } from "../utils/base64.js";
import { compileRoute } from "../utils/route.js";

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
            },
            globalPrefix: {
                type: "string",
                minLength: 2,
                description: "Reserved application-relative path prefix for global navigation. Defaults to /global."
            }
        },
        additionalProperties: false,
        description: "Navigation service configuration."
    };

    // vars
    #areas = null;
    #menus = null;
    #bus = null;
    #config = null;
    #container = null;
    #resolver = null;
    #logger;

    #mode = "";
    #appBasePath = "";
    #assetsBasePath = "";
    #compiledRoutes = new Map();

    #stack = [];
    #stackToDomTask = Promise.resolve();
    #browserHash = "";
    
    // ctor
    constructor( { areas, bus, config, menus, resolver, logger }, options = {}, { container = document.body } = {} ) {
        this.#logger = logger;
        // initialize injected dependencies
        this.#areas = areas;
        this.#menus = menus;
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
            params: Object.freeze({ ...p.params }),
            nav: Object.freeze({ ...p.nav }),
            ...(p.classes ? { classes: Object.freeze([...p.classes]) } : {})
        }));
    }
    
    // init
    async init() {
        if (this.#mode == "hash") {
            // hash mode
            this.#browserHash = document.location.hash;
            window.addEventListener("hashchange", () => {
                // Ignore echoes of changes already applied by Navigation.
                const hash = document.location.hash;
                if (hash === this.#browserHash) return;
                this.#browserHash = hash;
                return this.#restoreBrowserStack(hash || this.#areas.getDefaultArea()?.home);
            });
            // init
            if (this.#browserHash) {
                this.#stack = this.#browserUrlToStack(this.#browserHash);
                await this.#stackToDom();
            } else {
                let defaultArea = this.#areas.getDefaultArea();
                if (!defaultArea?.home) throw new Error("Default area has no navigation item marked default");
                await this.#stackToBrowser([this.parseUrl(defaultArea.home)], { replace: false });
            }
        } else if (this.#mode == "path") {
            // path mode
            window.addEventListener("popstate", () => {
                let url = document.location.pathname + document.location.search;
                if (url.startsWith(this.#appBasePath)) url = url.substring(this.#appBasePath.length);
                return this.#restoreBrowserStack(url + document.location.hash);
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
        return this.#replacePageUrl(page, src => this.#replacePageSrcQuery(src, changes));
    }
    replacePageHash(page, hash) {
        // replace one Page fragment without navigating or reloading the Page
        if (hash !== null && typeof(hash) !== "string") {
            throw new TypeError("Navigation.replacePageHash: hash must be a string or null.");
        }
        const fragment = hash ? `#${hash.replace(/^#+/, "")}` : "";
        return this.#replacePageUrl(page, src => this.#replacePageSrcHash(src, fragment));
    }
    buildUrlAbsolute(params){
        let href = this.#buildUrlPublic(params);
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")) return href;
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
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")) return href;
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
        let match;
        try {
            match = this.#findRouteMatch(this.#splitHref(item.href).identity);
        } catch (error) {
            this.#logger.warn("Navigation: route resolution failed");
            throw error;
        }
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
            scope,          // area | global
            outlet,         // target outlet for embed mode (outlet name or element)
            open = "auto",  // auto | top | stack | dialog | embed 
            context = {},   // additional context to be passed to the page (e.g. dialog parameters)
            classes,        // caller presentation classes for a stacked Page
            replace = false
        }) {
        // Record the operation without forwarding addresses, parameters or Page state.
        const startedAt = performance.now();
        this.#logger.debug("Navigation: requested");
        try {
            // Preserve explicit asset targets for embeds while retaining ordinary relative resolution.
            if (!open) open = "auto";
            const preserveAssetPath = open === "embed" && (href.startsWith("/") || href.startsWith(HASH_PREFIX + "/") || href.startsWith("page:"));
            const hrefResolved = this.#resolveCanonicalHref(href, page, { preserveAssetPath, scope });
            // Classify the resolved local destination without exposing its address.
            if (hrefResolved.startsWith("/") && !hrefResolved.startsWith("//")) {
                const navigationScope = matchesPathPrefix(this.#splitHref(hrefResolved).identity, this.#areas.globalPrefix) ? "global" : "area";
                this.#logger.trace("Navigation: scope determined", {scope: navigationScope});
            }
            const hrefAbsolute = this.buildUrl({ href: hrefResolved, params, nav, page });
            // Log the mode at the existing dispatch boundary.
            if (open == "auto") {
                const xpage = page?.host;
                const xpages = this.getXPages();
                const indexPage = xpages.indexOf(xpage);
                if (xpage == null || indexPage == 0) {
                    this.#logger.debug("Navigation: mode selected", {mode: "top"});
                    await this.#stackToBrowser([ this.parseUrl(hrefAbsolute) ], { replace });
                } else if (indexPage != -1) {
                    this.#logger.debug("Navigation: mode selected", {mode: "stack"});
                    const stack = [...this.#stack];
                    stack[indexPage] = withStackClasses(this.parseUrl(hrefAbsolute), classes);
                    await this.#stackToBrowser(stack, { replace });
                } else {
                    this.#logger.debug("Navigation: mode selected", {mode: "in-place"});
                    const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute));
                    xpage.setAttribute("src", hrefFinal);
                }
            } else if (open == "top") {
                this.#logger.debug("Navigation: mode selected", {mode: "top"});
                await this.#stackToBrowser([ this.parseUrl(hrefAbsolute) ], { replace });
            } else if (open == "stack") {
                this.#logger.debug("Navigation: mode selected", {mode: "stack"});
                await this.#stackToBrowser([...this.#stack, withStackClasses(this.parseUrl(hrefAbsolute), classes)], { replace });
            } else if (open == "dialog") {
                this.#logger.debug("Navigation: mode selected", {mode: "dialog"});
                const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute));
                const result = await this.#showDialog({ href: hrefFinal, context });
                this.#logger.debug("Navigation: dialog closed", {duration: performance.now() - startedAt});
                return result;
            } else if (open == "embed") {
                this.#logger.debug("Navigation: mode selected", {mode: "embed"});
                if (typeof outlet === "string") {
                    const xpage = page.host;
                    const outletElement = xpage.querySelector(`x-page[outlet="${outlet}"]`);
                    if (outletElement) {
                        const hrefFinal = this.#buildUrlFinal(this.parseUrl(hrefAbsolute), { preserveAssetPath });
                        outletElement.setAttribute("src", hrefFinal);
                    }
                }
            } else if (open == "dock") {
                this.#logger.debug("Navigation: mode selected", {mode: "dock"});
                this.#bus.emit("xshell:navigation:dock:changed", {src: hrefAbsolute});
            }
        } catch (error) {
            this.#logger.error("Navigation: operation failed", {duration: performance.now() - startedAt});
            throw error;
        }
    }


    // private methods
    async #stackToBrowser(stack, { replace }) {
        // Explicit navigation updates the browser and reconciles the stack.
        this.#writeBrowserStack(stack, { replace });
        return this.#stackToDom();
    }
    #replacePageUrl(page, replaceSource) {
        // Ignore an outgoing Page, even before a queued reconciliation updates its host.
        const xpage = page?.host;
        if (xpage?.canSynchronizePageSrc?.(page) === false) return null;
        const index = xpage ? this.getXPages().indexOf(xpage) : -1;
        if (index < 0) return replaceSource(page?.src);
        const item = this.#stack[index];
        if (!item || !this.#isPageDestination(xpage, item)) return null;

        // Keep the friendly route when it can represent the requested change.
        const stack = [...this.#stack];
        const { href, params } = this.parseUrl(replaceSource(this.buildUrl(item)));
        stack[index] = { ...item, href, params };
        let src = this.#buildUrlFinal(stack[index]);
        const updatedSource = replaceSource(this.#buildUrlFinal(item));
        if (!this.#sameDestination(this.#pageDestination(src), this.#pageDestination(updatedSource))) {
            // Store the canonical destination when a route or menu default would mask the change.
            const canonical = this.parseUrl(updatedSource);
            stack[index] = { ...item, href: canonical.href, params: canonical.params };
            src = this.#buildUrlFinal(stack[index]);
        }

        // Replace one history entry and let Page synchronize its own and its host's source.
        this.#writeBrowserStack(stack, { replace: true });
        return src;
    }
    #writeBrowserStack(stack, { replace }) {
        let url = "";
        if (stack.length) {
            // root page
            const root = stack[0];
            url = this.#buildUrlPublic({
                href: root.href,
                params: root.params,
                nav: (stack.length == 1 ? root.nav : null)
            }, { preserveArea: true });
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
            this.#browserHash = location.hash;
        } else if (this.#mode === "path") {
            if (replace) {
                history.replaceState(null, "", this.#appBasePath + url);
            } else {
                history.pushState(null, "", this.#appBasePath + url);
            }
        }
    }
    async #restoreBrowserStack(url) {
        // History traversal uses the same reconciliation as explicit navigation.
        const startedAt = performance.now();
        try {
            this.#stack = this.#browserUrlToStack(url);
            await this.#stackToDom();
            this.#logger.debug("Navigation: browser history restored", {mode: this.#mode, stackDepth: this.#stack.length, duration: performance.now() - startedAt});
        } catch {
            this.#logger.error("Navigation: browser history restoration failed", {mode: this.#mode});
        }
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

        // Validate restored global destinations before replacing the stack or touching the DOM.
        for (const item of stack) {
            const { identity } = this.#splitHref(item.href);
            if (matchesPathPrefix(identity, this.#areas.globalPrefix)) this.#validateGlobalDestination(identity);
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
        // Resolve a snapshot before reconciling so pending cleanup cannot mix stack revisions.
        const startedAt = performance.now();
        const stack = this.#stack;
        const sources = stack.map(item => this.#buildUrlFinal(item));
        const xpages = this.getXPages();
        const domStack = xpages.map(xpage => this.#pageDestination(xpage.src));
        const destinations = sources.map(src => this.#pageDestination(src));

        // Detect structural navigation, ignoring query parameters and URL fragments.
        const structuralChange = domStack.length !== stack.length ||
            domStack.some((before, index) => before.identity !== destinations[index].identity);

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
        for (let i = 0; i < Math.max(stack.length, domStack.length); i++) {
            let itemBefore = domStack[i];
            let itemAfter = stack[i];
            if (!itemBefore && itemAfter) {
                //add page
                let xpage = document.createElement("x-page");
                xpage.setAttribute("src", sources[i]);
                if (i == 0) {
                    xpage.setAttribute("layout", "main");
                    //emit event navigation-start
                    this.#bus.emit("xshell:navigation:start", { src: xpage.src });
                } else {
                    xpage.setAttribute("layout", "stack");
                    xpage.stackClasses = itemAfter.classes;
                    xpage.addEventListener("close", async (event) => {
                        // Close only a host that still represents the selected stack entry.
                        const index = this.getXPages().indexOf(event.target);
                        const item = this.#stack[index];
                        if (!item || !this.#isPageDestination(event.target, item)) return;
                        const nextStack = [...this.#stack];
                        nextStack.splice(index, 1);
                        await this.#stackToBrowser(nextStack, { replace: false }).catch(() => {
                            this.#logger.error("Navigation: stacked Page close failed", {mode: "stack"});
                        });
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
                if (!this.#sameDestination(itemBefore, destinations[i])) {
                    xpage.src = sources[i];
                    //emit event navigation-start
                    if (i == 0) {
                        this.#bus.emit("xshell:navigation:start", { src: xpage.src });
                    }
                }
            }
        }
        this.#logger.debug("Navigation: stack reconciled", {stackDepth: stack.length, duration: performance.now() - startedAt});
    }
    #pageDestination(src) {
        // Compare decoded query values in key order, preserving the order of repeated values.
        const { identity, suffix } = this.#splitHref(src);
        const hashIndex = suffix.indexOf("#");
        const hash = hashIndex < 0 ? "" : suffix.substring(hashIndex);
        const params = new URLSearchParams(hashIndex < 0 ? suffix : suffix.substring(0, hashIndex));
        params.delete("nav");
        params.sort();
        return { identity, hash, query: params.toString() };
    }
    #sameDestination(before, after) {
        // Keep explicit fragment navigation on the normal Page loading path.
        return before.identity === after.identity && before.query === after.query && before.hash === after.hash;
    }
    #isPageDestination(host, item) {
        // Check whether the host still represents the latest requested stack entry.
        return this.#sameDestination(this.#pageDestination(host.src), this.#pageDestination(this.#buildUrlFinal(item)));
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

        // Global URLs already address the Page and bypass Area aliases and routes.
        if (matchesPathPrefix(identity, this.#areas.globalPrefix)) return this.buildUrl(item);

        // Keep explicit embedded resources out of friendly menu and route matching.
        if (preserveAssetPath) {
            const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
            if (this.#isAssetPath(identity) || this.#isAssetPath(this.#removePathPrefix(identity, area?.prefix))) return this.buildUrl(item);
        }
        const menuitem = this.#menus.resolvePath(identity);
        if (menuitem) {
            // Apply an alias's defaults before the invocation's explicit query and fragment.
            const target = this.parseUrl(menuitem.href);
            const targetParts = this.#splitHref(target.href);
            return this.buildUrl({
                ...item,
                href: targetParts.identity + (suffix || targetParts.suffix),
                params: { ...target.params, ...item.params }
            });
        }
        const match = this.#findRouteMatch(identity);
        if (match) return this.#buildRouteHref(match, item, match.area);
        return this.buildUrl({
            ...item,
            href: identity + suffix
        });
    }
    #buildUrlPublic(params, { preserveArea = false } = {}) {
        const target = this.#resolvePublicTarget(params.href, params.params || {}, params.page, params.scope, preserveArea);
        return this.buildUrl({ ...params, href: target.href, params: target.params });
    }
    #resolvePublicHref(href, page) {
        return this.#resolvePublicTarget(href, {}, page).href;
    }
    #resolvePublicTarget(href, params, page, scope, preserveArea) {
        // leave external targets under native browser control
        if (!href.startsWith("page:") && (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//"))) return { href, params };
        // An existing stack URL already fixes its Area, including an empty-prefix Area.
        const stackArea = preserveArea ? this.#areas.getArea?.(this.#areas.resolveAreaId?.(href)) : null;
        const canonicalHref = stackArea ? href : this.#resolveCanonicalHref(href, page, { scope });
        const { identity, suffix } = this.#splitHref(canonicalHref);
        if (matchesPathPrefix(identity, this.#areas.globalPrefix)) return { href: canonicalHref, params };

        // Prefer an Area alias, then try reverse routing.
        const area = stackArea || this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
        const menuitem = area ? this.#menus.resolveHref(identity, area.id) : null;
        if (menuitem) {
            // Use the friendly path only when resolving it can reproduce the invocation.
            if (!menuitem.path) return { href: canonicalHref, params };
            const target = this.parseUrl(menuitem.href);
            const supplied = { ...this.parseUrl(canonicalHref).params, ...params };
            const targetFragment = this.#splitHref(target.href).suffix;
            if (Object.keys(target.params).every(key => Object.hasOwn(supplied, key)) && (!targetFragment || suffix.includes("#"))) {
                return { href: menuitem.path + suffix, params };
            }
            return { href: canonicalHref, params };
        }
        // Keep explicit Area paths and preserve the Area chosen for a stack entry or a global Page.
        const input = this.#splitHref(this.#toLogicalHref(href)).identity;
        const explicitArea = this.#areas.getArea?.(this.#areas.resolveAreaId?.(input));
        const fromGlobal = page?.src && matchesPathPrefix(this.#splitHref(page.src).identity, this.#areas.globalPrefix);
        const routeAreas = stackArea || explicitArea?.prefix || fromGlobal ? [area].filter(Boolean)
            : [...new Set([area, this.#areas.getCurrentArea?.(), ...(this.#areas.getAreas?.() ?? [])].filter(Boolean))];
        for (const routeArea of routeAreas) {
            const routeTarget = this.#resolvePublicRouteTarget(canonicalHref, params, routeArea);
            if (routeTarget) return routeTarget;
        }
        return { href: canonicalHref, params };
    }
    #resolveCanonicalHref(href, page, { preserveAssetPath = false, scope } = {}) {
        // Resolve Page references and relative targets before selecting a navigation prefix.
        if (href.startsWith("page:")) {
            const { identity, suffix } = this.#splitHref(href);
            const resolved = this.#resolver.resolve(identity);
            if (!resolved?.path) throw new Error(`Navigation: unable to resolve Page reference '${identity}' to a browser path.`);
            href = resolved.path + suffix;
            this.#logger.trace("Navigation: canonical Page reference resolved", {moduleId: resolved.definition?.moduleId});
        }
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")) return href;
        href = this.#toLogicalHref(href);
        const origin = this.#splitHref(page?.src || "/").identity;
        let { identity, suffix } = this.#splitHref(href);
        if (!identity.startsWith("/")) identity = identity ? combineUrls(origin, identity) : origin;

        // The URL carries global context after resolution. An explicit scope can change it.
        const globalPrefix = this.#areas.globalPrefix;
        if (matchesPathPrefix(identity, globalPrefix)) {
            if (scope !== "area") return this.#validateGlobalDestination(identity) + suffix;
            identity = this.#removePathPrefix(identity, globalPrefix);
        }
        const targetArea = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
        if (scope === "global") {
            const resource = this.#isAssetPath(identity) ? identity : this.#removePathPrefix(identity, targetArea?.prefix);
            return this.#validateGlobalDestination(globalPrefix + resource) + suffix;
        }
        if (targetArea?.prefix) return identity + suffix;

        // A global Page can follow a declared root-Area path or a unique canonical Area home.
        const fromGlobal = matchesPathPrefix(origin, globalPrefix);
        if (fromGlobal) {
            if (targetArea && !this.#isAssetPath(identity) && (this.#menus.resolvePath(identity) || this.#findRouteMatch(identity))) {
                return identity + suffix;
            }
            const entryArea = this.#isAssetPath(identity) ? this.#findAreaHome(identity) : null;
            if (entryArea) return this.#applyAreaPrefix(identity, entryArea) + suffix;
            if (scope !== "area") return this.#validateGlobalDestination(globalPrefix + identity) + suffix;
        }

        // Preserve an explicit canonical asset path before looking up the originating Area or menu.
        if (preserveAssetPath && scope !== "area" && this.#isAssetPath(identity)) return identity + suffix;
        const pageAreaId = scope === "area" && fromGlobal ? this.#areas.getCurrentArea?.()?.id
            : page?.src ? this.#areas.resolveAreaId?.(page.src) : null;
        const menuitem = this.#menus.resolveHref(identity, pageAreaId) || this.#menus.resolveHref(identity);
        if (menuitem) return this.#splitHref(menuitem.href).identity + suffix;
        const area = page && scope !== "area" ? this.#areas.getArea?.(pageAreaId)
            : this.#areas.getArea?.(pageAreaId) || this.#areas.getCurrentArea?.() || this.#areas.getDefaultArea?.();
        const canonicalHref = this.#applyAreaPrefix(identity, area);
        return canonicalHref + suffix;
    }
    #findAreaHome(identity) {
        // Compare canonical home identities, ignoring invocation parameters and fragments.
        let match = null;
        for (const area of this.#areas.getAreas()) {
            if (!area.home) continue;
            const home = this.#splitHref(area.home).identity;
            const href = this.#menus.resolvePath(home)?.href ?? home;
            if (this.#removePathPrefix(this.#splitHref(href).identity, area.prefix) !== identity) continue;
            if (match) return null;
            match = area;
        }
        return match;
    }
    #validateGlobalDestination(identity) {
        // Only a canonical Page resource can follow the reserved prefix.
        const resource = this.#removePathPrefix(identity, this.#areas.globalPrefix);
        if (resource === this.#assetsBasePath || !this.#isAssetPath(resource) || !this.#resolver.has("page:" + resource)) {
            throw new Error(`Navigation: global destination '${identity}' must identify a canonical Page resource under '${this.#assetsBasePath}'.`);
        }
        return identity;
    }
    #findRouteMatch(identity) {
        // select the Area from the public path and match against Area-relative declarations
        const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(identity));
        if (!area) return null;
        const match = this.#matchAreaRoutes(this.#removePathPrefix(identity, area.prefix), area);
        if (match) {
            this.#logger.trace("Navigation: route resolved", {areaId: area.id, moduleId: match.route.module});
        }
        return match ? { area, ...match } : null;
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
            compiled = compileRoute(path);
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
    #resolvePublicRouteTarget(canonicalHref, suppliedParams, area) {
        // Compare targets in the candidate Area while retaining the invocation's query and fragment.
        const canonical = this.parseUrl(canonicalHref);
        const canonicalParts = this.#splitHref(canonical.href);
        const canonicalArea = this.#areas.getArea?.(this.#areas.resolveAreaId?.(canonicalParts.identity));
        const canonicalIdentity = this.#removePathPrefix(canonicalParts.identity, canonicalArea?.prefix);
        const targetIdentity = this.#applyAreaPrefix(canonicalIdentity, area);
        const canonicalParams = { ...canonical.params, ...suppliedParams };
        for (const route of area.routes || []) {
            const target = this.parseUrl(route.href);
            const targetParts = this.#splitHref(target.href);
            if (this.#applyAreaPrefix(targetParts.identity, area) !== targetIdentity || (targetParts.suffix && !canonicalParts.suffix)) continue;
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
            // Check browser path normalization, Area ownership, and the effective forward match.
            const publicPath = area.prefix + routePath;
            if (publicPath.startsWith("//") || this.#areas.resolveAreaId(publicPath) !== area.id) continue;
            if (this.#mode === "path") {
                const renderedPath = this.#appBasePath + publicPath;
                if (new URL(renderedPath, this.#config.app.baseUrl).pathname !== renderedPath) continue;
            }
            const invocation = { href: publicPath + canonicalParts.suffix, params: remainingParams };
            let resolved;
            try {
                resolved = this.parseUrl(this.#buildUrlFinal(invocation));
            } catch (error) {
                // An earlier parameterized route may reject percent encoding in a literal candidate.
                if (error.cause instanceof URIError) continue;
                throw error;
            }
            if (resolved.href !== targetIdentity + canonicalParts.suffix ||
                Object.keys(resolved.params).length !== Object.keys(canonicalParams).length ||
                !Object.entries(canonicalParams).every(([key, value]) => resolved.params[key] === String(value))) continue;
            return invocation;
        }
        return null;
    }
    #removePathPrefix(path, prefix) {
        // Derive the path relative to its navigation context.
        return matchesPathPrefix(path, prefix) ? path.substring(prefix.length) || "/" : path;
    }
    #applyAreaPrefix(path, area) {
        // apply the public navigation context exactly once
        if (!area?.prefix || matchesPathPrefix(path, area.prefix)) return path;
        return area.prefix + path;
    }
    #toLogicalHref(href) {
        // Rendered native links may already contain App.BasePath.
        if (href.startsWith(HASH_PREFIX)) return href.substring(HASH_PREFIX.length);
        const hashBase = this.#appBasePath + "/" + HASH_PREFIX;
        if (this.#mode === "hash" && href.startsWith(hashBase)) return href.substring(hashBase.length);
        const { identity, suffix } = this.#splitHref(href);
        if (!matchesPathPrefix(identity, this.#appBasePath)) return href;
        const applicationIdentity = identity.substring(this.#appBasePath.length) || "/";
        const globalPrefix = this.#areas.globalPrefix;
        if (matchesPathPrefix(applicationIdentity, globalPrefix)) return applicationIdentity + suffix;
        if (matchesPathPrefix(identity, globalPrefix)) return href;

        // Outside the global namespace, only strip App.BasePath from structural asset URLs.
        if (this.#isAssetPath(applicationIdentity)) return applicationIdentity + suffix;
        const area = this.#areas.getArea?.(this.#areas.resolveAreaId?.(applicationIdentity));
        return this.#isAssetPath(this.#removePathPrefix(applicationIdentity, area?.prefix)) ? applicationIdentity + suffix : href;
    }
    #isAssetPath(path) {
        // Require a namespace boundary so similarly named friendly paths still resolve normally.
        return matchesPathPrefix(path, this.#assetsBasePath);
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

