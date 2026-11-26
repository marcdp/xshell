import Page from "./page.js";
import { matchesPathPrefix } from "./utils/urls.js";

// stylesheet
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(`
    :host {display:block;}
`);


export function createXPageClass(runtime) {
    // Capture the capabilities for browser-created elements.
    return class XPage extends HTMLElement {


        //static
        static get observedAttributes() {
            return ["src", "layout", "module", "loading"];
        }


        //fields
        _connected = false;
        _src = "";
        _layout = "";
        _status = "";
        _context = {};
        _stackClasses;

        _loadRevision  = 0;
        _pageLoadRevision = 0;
        _loadCommit = null;

        _loading = "";
        _loadingObserver = null;
        _module = null;
        _page = null;


        //ctor
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            // adopt module-wide Shadow DOM defaults before the native x-page stylesheet
            const sharedStyleSheets = runtime.modules?.shadowStyleSheets ?? [];
            this.shadowRoot.adoptedStyleSheets = [...sharedStyleSheets, stylesheet];
            this.addEventListener("queryClose", () => {
                // query close
                this.queryClose();
            });
            this.addEventListener("command", (event) => {
                // handle command
                this.page?.onCommand(event.detail.command, event.detail.data, { event });
                event.preventDefault();
                event.stopPropagation();
                return false;
            });
            this.addEventListener("click", (event) => {
                const path = typeof event.composedPath === "function" ? event.composedPath() : [];
                const a = event.target?.closest?.("a") || path.find(element => element?.localName === "a");
                const xpage = a?.closest?.("x-page") || path.find(element => element === this || element?.localName === "x-page");
                if (!a || xpage !== this ||
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
                    (a.target && a.target.toLowerCase() !== "_self") ||
                    a.hasAttribute("download") ) {
                    // normal browser navigation
                    return;
                }
                const href = a.getAttribute("href");
                // leave native URLs alone while preserving XShell's hash-navigation prefix
                if (!href || (href.startsWith("#") && !href.startsWith("#!")) ||
                    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")) return;
                // handle navigation
                const item = {
                    href,
                    open: "auto",
                    page: xpage.page
                };
                runtime.navigation.navigate( item );
                event.preventDefault();
                event.stopPropagation();
                return false;
            });
        }


        //props
        get src() {return this._src;}
        set src(value) {
            value ??= "";
            let changed = (this._src != value);
            if (value && !value.startsWith("/") && value.indexOf("://") == -1 && this.src) {
                let aux = this.src;
                aux = aux.substring(0, aux.lastIndexOf("/"));
                value = aux + "/" + value;
            }
            this._src = value;
            if (changed){
                if (this._src && this._connected) this.#loadSource();
            }
        }
        get status() {return this._status;}
        get page() {return this._page;}

        get breadcrumb() {return this._page.breadcrumb; }
        set breadcrumb(value) { this._page.breadcrumb = value; }

        get result() {return this._page?.result ?? null;}
        set result(value) {this._page.result = value;}

        get layout() { return this._layout;}
        set layout(value) { this._layout = value;}

        set stackClasses(value) {
            // Forward presentation changes to the current Stack layout without loading the Page.
            if (value === this._stackClasses) return;
            this._stackClasses = value;
            if (this._layout === "stack" && this.shadowRoot.firstChild) {
                this.shadowRoot.firstChild.stackClasses = value ?? [];
            }
        }

        get module() { return this._module; }
        set module(value) { this._module = value; }

        get label() {return this._page?.label || "";}
        set label(value) {
            let changed = (this._page.label != value);
            this._page.label = value;
            if (changed) {
                this.dispatchEvent(new CustomEvent("change"));
            }
        }

        get description() {return this._page?.description || "";}
        set description(value) {
            let changed = (this._page.description != value);
            this._page.description = value;
            if (changed) {
                this.dispatchEvent(new CustomEvent("change"));
            }
        }

        get icon() {return this._page?.icon || "";}
        set icon(value) {
            let changed = (this._page.icon != value);
            this._page.icon = value;
            if (changed) {
                this.dispatchEvent(new CustomEvent("change"));
            }
        }

        get context() {return this._context;}
        set context(value) { this._context = Object.freeze(value); }

        //events
        attributeChangedCallback(name, oldValue, newValue) {
            if (name == "src") this.src = newValue;
            if (name == "layout") this.layout = newValue;
            if (name == "module") this.module = newValue;
            if (name == "loading") this.loading = newValue;
        }
        connectedCallback() {
            this._connected = true;
            if (this._page && this._page.src === this._src) {
                this.mount();
                return;
            }
            // load now, or on the first activation
            if (this.loading == "lazy") {
                // intersection observer
                const onIntersection = (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            if (this.loading == "lazy" && this._status == "") {
                                this.#loadSource();
                            }
                        }
                    });
                };
                // set up the IntersectionObserver
                this._loadingObserver = new IntersectionObserver(onIntersection, {rootMargin: "10px"}); // start loading just before it comes into view
                this._loadingObserver.observe(this); // start observing the element

            } else if (this._src) {
                // load
                this.#loadSource();
            }
        }
        disconnectedCallback() {
            this._connected = false;
            // unmount current page; disconnection does not imply final destruction
            this.unmount();
        }
        connectedMoveCallback() {
            // A state-preserving DOM move keeps the existing Page mounted.
        }


        //methods
        async #loadSource() {
            // Report automatic load failures while keeping explicit load() calls awaitable.
            try {
                await this.load();
            } catch (error) {
                console.error("x-page: could not load the Page.", error);
            }
        }
        async load() {
            console.log(`x-page: load '${this.src} ...`);
            let src = this.src;
            let loadRevision = ++this._loadRevision;

            // reset
            this._status = "loading";

            // set layout as loading (if exists)
            let layoutElement = this.shadowRoot.firstChild;
            if (layoutElement) {
                layoutElement.setAttribute("status", "loading");
            }

            // layout
            let layoutName = this._layout;
            if (!layoutName) layoutName = "embed";
            let layout = runtime.config.xshell.ui.layouts[layoutName];
            let layoutClass = await runtime.loader.load("layout:" + layout);
            if (loadRevision !== this._loadRevision) return;
            if (layoutElement == null || layoutElement.localName != layout) {
                if (layoutElement) layoutElement.remove();
                layoutElement = document.createElement(layout);
                layoutElement.innerHTML = "<slot></slot><slot name=\"header-actions\" slot=\"header-actions\"></slot>";
                // Seed the Stack layout before it mounts and renders its opening animation.
                if (layoutName === "stack" && this._stackClasses) layoutElement.stackClasses = this._stackClasses;
                this.shadowRoot.appendChild(layoutElement);
                layoutElement.setAttribute("status", "loading");
            }
            this._layout = layoutName;

            // remove navigation context before resolving the module resource
            const globalPrefix = runtime.areas.globalPrefix;
            const isGlobal = matchesPathPrefix(src.split(/[?#]/, 1)[0], globalPrefix);
            const area = runtime.areas.getArea(runtime.areas.resolveAreaId(src));
            const prefix = isGlobal ? globalPrefix : area?.prefix;
            const resourceSrc = prefix ? src.substring(prefix.length) : src;
            let moduleId = runtime.modules.resolveModuleId(resourceSrc);
            this.setAttribute("module", moduleId ?? "");

            let page = null;
            let pageAdopted = false;
            let failure = null;
            let failed = false;
            try {
                // fetch the candidate Page or prepare the existing fallback Page
                try {
                    const pageClass = await runtime.loader.load("page:" + resourceSrc);
                    page = new pageClass( { src, context: this._context, bus: runtime.bus, navigation: runtime.navigation } );
                } catch(exception) {
                    page = new Page({ src, bus: runtime.bus, navigation: runtime.navigation });
                    page.onCommand = (command, params) => {
                        if (command == "mount") {
                            exception.src = src;
                            exception.areaId = area?.id;
                            exception.moduleId = moduleId;
                            this.showError( exception );
                        }
                    }
                }

                // delay
                if (false && (src.indexOf("dialog")!=-1 || document.body.querySelectorAll(":scope > x-page").length > 1)) {
                    await new Promise(r => setTimeout(r, 1000111));
                }

                // search params
                let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1).split("#")[0] : "");

                // nav
                let nav = null;
                if (searchParams.get("nav")) {
                    nav = JSON.parse(atob(searchParams.get("nav").replace(/_/g, "/").replace(/-/g, "+")));
                    nav.breadcrumb = nav.breadcrumb || [];
                    nav.breadcrumb.push({ label: page.label, href: src });
                    searchParams.delete("nav");
                }

                // breadcrumb
                let breadcrumb = isGlobal ? null : runtime.areas.getMenuitemBreadcrumb(src, area?.id);
                if (nav && nav.breadcrumb) {
                    breadcrumb = nav.breadcrumb;
                }
                page.breadcrumb = breadcrumb;

                // title
                let label = page.label;
                if (nav && nav.title) {
                    label = nav.title;
                    if (breadcrumb && breadcrumb.length > 0) breadcrumb[breadcrumb.length - 1].label = label;
                }
                if (!label) {
                    if (breadcrumb && breadcrumb.length > 0) label = breadcrumb[breadcrumb.length - 1].label;
                }
                if (this._layout == "dialog" && this._context && this._context.title){
                    label = this._context.title;
                }
                page.label = label;

                // icon
                let icon = page.icon;
                if (!icon && breadcrumb && breadcrumb.length > 0) icon = breadcrumb[breadcrumb.length - 1].icon;
                if (nav && nav.icon) {
                    icon = nav.icon;
                    if (breadcrumb && breadcrumb.length > 0) breadcrumb[breadcrumb.length - 1].icon = icon;
                }
                if (!icon) {
                    if (breadcrumb && breadcrumb.length > 0) icon = breadcrumb[breadcrumb.length - 1].icon;
                }
                page.icon = icon;

                // prepare the candidate before entering the serialized replacement queue
                await page.load();
                if (loadRevision === this._loadRevision) {
                    const loadCommit = (this._loadCommit ?? Promise.resolve()).then(async () => {
                        // abandon a candidate that became stale while waiting in the queue
                        if (loadRevision !== this._loadRevision) return;

                        // replace the current Page before transferring ownership of the candidate
                        await this.unmount();
                        await this.unload();
                        if (loadRevision !== this._loadRevision) return;
                        this._page = page;
                        this._pageLoadRevision = loadRevision;
                        pageAdopted = true;

                        // mount the adopted Page through the ordinary host lifecycle
                        await this.mount();
                        if (loadRevision === this._loadRevision) {
                            this._status = "loaded";
                            if (layoutElement) layoutElement.removeAttribute("status");
                            this.dispatchEvent(new CustomEvent("load", { detail: { page } }));
                        }
                    });

                    // keep the queue usable while propagating this transition's failure to its caller
                    this._loadCommit = loadCommit.catch(() => {});
                    await loadCommit;
                }
            } catch(error) {
                failure = error;
                failed = true;
            } finally {
                // release every candidate that did not transfer to the XPage lifecycle
                if (page && !pageAdopted) {
                    try {
                        await page.unload();
                    } catch(cleanupError) {
                        failure = failed
                            ? new AggregateError([failure, cleanupError], `Page '${src}' preparation and cleanup both failed.`, { cause: failure })
                            : cleanupError;
                        failed = true;
                    }
                }
            }

            if (failed) throw failure;
        }
        async unmount() {
            // unmount
            if (this._page) {
                await this._page.unmount();
            }
        }
        canSynchronizePageSrc(page) {
            // Only the current Page can update the source selected by this host.
            return this._page === page && this._pageLoadRevision === this._loadRevision;
        }
        synchronizePageSrc(value) {
            // update reflected Page source state without invoking the resource-loading setter
            this._src = value;
        }
        async unload() {
            // unload
            const page = this._page;
            if (page) {
                await page.unload();
                if (this._page === page) {
                    this._page = null;
                }
            }
        }
        async mount() {
            // mount
            if (this._page) {
                await this._page.mount({ host: this });
            }
        }
        async queryClose() {
            let allowClose = true;
            // ... query close page (ask page for permissions to close) ...
            if (allowClose) this.close();
        }
        async close(result) {
            //close page
            if (result != undefined) this._page.result = result;
            this.dispatchEvent(new CustomEvent("close", { composed: true }));
        }
        async removePage() {
            // Invalidate pending candidates and let an in-progress replacement finish cleanup.
            this._loadRevision++;
            if (this._loadCommit) await this._loadCommit;
            // try to close the layout if it exists
            let layoutElement = this.shadowRoot.firstChild;
            if (layoutElement && layoutElement.controller.close) {
                await layoutElement.controller.close();
            }
            // destroy current page before the host is removed permanently
            await this.unmount();
            await this.unload();
            //remove dom element
            let removeHandler = ()=> {
                this.remove();
            };
            if (layoutElement) {
                removeHandler = await layoutElement.unload() || removeHandler;
            }
            //remove DOM node
            removeHandler();
        }
        async showError({code, message, src, moduleId, areaId, stack, details, errors}) {
            // show error
            let name = runtime.config.xshell.ui.components.error;
            const errorCoomponentClass = await runtime.loader.load("component:" + name);
            const errorComponent = new errorCoomponentClass();
            errorComponent.code = code;
            errorComponent.message = message;
            errorComponent.src = src;
            errorComponent.moduleId = moduleId;
            errorComponent.areaId = areaId;
            errorComponent.stack = stack;
            errorComponent.details = details;
            errorComponent.errors = errors;
            this.replaceChildren(errorComponent);
        }
    };
}
