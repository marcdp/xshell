import { generateId } from "./utils/ids.js";

// Page loaders use this lifecycle check before mounting or releasing their own resources.
export const pageUnloaded = Symbol("pageUnloaded");

// class
export default class Page {


    //vars
    #id = null;
    #src = null;
    #context = null;
    #label = null;
    #description = null;
    #breadcrumb = null;
    #icon = null;
    #result = null;
    #bus = null;
    #navigation = null;

    #host = null;
    #refs = null;
    #loaded = false;
    #unloaded = false;

    //ctor
    constructor({ src, context, bus, navigation }) {
        this.#src = src;
        this.#context = context;
        this.#bus = bus;
        this.#navigation = navigation;
        this.#id = generateId("page");
    }


    //props
    get host() { return this.#host; }
    get [pageUnloaded]() { return this.#unloaded; }

    get id() { return this.#id; }
    set id(value) { this.#id = value; }

    get path() {
        if (!this.#src) return {};
        const url = new URL(this.#src, document.baseURI);
        return url.pathname;
    }
    get query() { 
        if (!this.#src) return {};
        const url = new URL(this.#src, document.baseURI);
        return Object.fromEntries(url.searchParams.entries());
    }

    get src() { return this.#src; }
    get layout() { return this.#host?.layout; }
    
    get context() { return this.#context; }

    get label() { return this.#label; }
    set label(value) { 
        this.#label = value;
        if (this.#breadcrumb && this.#breadcrumb.length > 0) this.#breadcrumb[this.#breadcrumb.length - 1].label = value;
        if (this.#loaded) {
            this.#bus.emit("xshell:page:change", { src: this.#src, id: this.#id, label: this.#label, description: this.#description, result: this.#result });
        }
    }

    get description() { return this.#description; }
    set description(value) { 
        this.#description = value;
        if (this.#breadcrumb && this.#breadcrumb.length > 0) this.#breadcrumb[this.#breadcrumb.length - 1].description = value;
        if (this.#loaded) {
            this.#bus.emit("xshell:page:change", { src: this.#src, id: this.#id, label: this.#label, description: this.#description, result: this.#result });
        }
    }

    get breadcrumb() { return this.#breadcrumb; }
    set breadcrumb(value) { this.#breadcrumb = value; }

    get icon() { return this.#icon; }
    set icon(value) { 
        this.#icon = value;
        if (this.#breadcrumb && this.#breadcrumb.length > 0) this.#breadcrumb[this.#breadcrumb.length - 1].icon = value;
        if (this.#loaded) {
            this.#bus.emit("xshell:page:change", { src: this.#src, id: this.#id, label: this.#label, description: this.#description, result: this.#result });
        }
    }

    get meta() { return this.constructor.definition?.meta ?? {}; }

    get contract() { return this.constructor.definition?.contract ?? {}; }

    get result() { return this.#result; }
    set result(value) { 
        this.#result = value;
        if (this.#loaded) {
            this.#bus.emit("xshell:page:change", { src: this.#src, id: this.#id, label: this.#label, description: this.#description, result: this.#result });
        }
    }

    get refs() {
        if (!this.#refs) {
            this.#refs = new Proxy(this.#host, {
                get: (target, prop) => {
                  return target.querySelector(`[ref="${prop}"]`);
                }
            });
        }
        return this.#refs;
    }

    // lifecycle methods
    async load() {
        if (this.#loaded || this.#unloaded) return;
        this.#loaded = true;
        // call load command
        const url = new URL(this.#src, document.baseURI);
        const params = {
            query: Object.fromEntries(url.searchParams.entries()),
            path: url.pathname,
            hash: url.hash,
            context: this.#context
        };
        await this.onCommand("load", params);
        // bus event
        this.#bus.emit("xshell:page:load", { src: this.#src, id: this.#id });
    }
    async mount({ host, renderEngine }) {
        if (this.#unloaded) return;
        // mount
        this.#host = host;
        await this.onCommand("mount", {});
    }
    // Definition-based Pages override these hooks to dispatch to their controller.
    hasCommand() { return false; }
    async onCommand() {}
    async unmount() {
        if (this.#unloaded) return;
        // unmount
        await this.onCommand("unmount", {});
        this.#host = null;
    }
    async unload() {
        if (this.#unloaded) return;
        this.#unloaded = true;

        // invoke controller unload while preserving final Page cleanup on failure
        const errors = [];
        try {
            await this.onCommand("unload", {});
        } catch (error) {
            errors.push(error);
        }

        // release Page runtime references and publish the unload notification
        this.#host = null;
        this.#refs = null;
        try {
            this.#bus.emit("xshell:page:unload", { src: this.#src, id: this.#id });
        } catch (error) {
            errors.push(error);
        }

        // propagate all lifecycle failures after cleanup has completed
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, `Multiple errors occurred while unloading Page '${this.#id}'.`);
    }

    // close methods
    close(result) {
        // close
        return this.#host.close(result);
    }

     // url methods (replace this Page's query or fragment without navigating or reloading it)
    replaceQuery(query) {
        const src = this.#navigation.replacePageQuery(this, query);
        if (src !== null && typeof(src) !== "undefined") {
            this.#src = src;
            if (this.#host && typeof(this.#host.synchronizePageSrc) === "function") {
                this.#host.synchronizePageSrc(src);
            }
        }
        return src;
    }
    replaceHash(hash) {
        const src = this.#navigation.replacePageHash(this, hash);
        if (src !== null && typeof(src) !== "undefined") {
            this.#src = src;
            if (this.#host && typeof(this.#host.synchronizePageSrc) === "function") {
                this.#host.synchronizePageSrc(src);
            }
        }
        return src;
    }

}
