
// class
export default class Resolver {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
        },
        additionalProperties: false
    };


    // vars
    #definitions = [];
    #appBaseUrl;
    

    //ctor
    constructor( { config }, options) {
        // Compile the configured global resource categories into one deterministic rule list.
        this.#appBaseUrl = config.app.baseUrl;
        for (const [type, patterns] of Object.entries(config.xshell.resolver)) {
            for (const [pattern, definition] of Object.entries(patterns)) this.addDefinition(`${type}:${pattern}`, definition);
        }
        this.#definitions.sort((a, b) => a.resource.localeCompare(b.resource));
    }

    // props
    get registry() {
        // Expose rule metadata without sharing mutable definitions or regular expressions.
        return Object.freeze(this.#definitions.map(definition => Object.freeze({
            resource: definition.resource,
            src: definition.src,
            loader: definition.loader,
            cache: definition.cache,
            cacheMode: definition.cacheMode
        })));
    }

    //methods
    addDefinition(resource, value) {
        // Compile literal text and validated placeholders without exposing regular expression syntax.
        let regexp = "^";
        let index = 0;
        let previousTokenWasPlaceholder = false;
        const placeholders = new Set();
        while (index < resource.length) {
            const literalStart = index;
            while (index < resource.length && resource[index] !== "{" && resource[index] !== "}") index++;
            if (index > literalStart) {
                regexp += resource.substring(literalStart, index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                previousTokenWasPlaceholder = false;
            }
            if (index === resource.length) break;
            if (resource[index] === "}") throw new Error(`Invalid resolver pattern '${resource}': unmatched '}'.`);
            if (previousTokenWasPlaceholder) throw new Error(`Invalid resolver pattern '${resource}': adjacent placeholders are not supported.`);

            // Validate each placeholder before compiling its named capture.
            const end = resource.indexOf("}", index + 1);
            if (end === -1) throw new Error(`Invalid resolver pattern '${resource}': unmatched '{'.`);
            const name = resource.substring(index + 1, end);
            if (name.length === 0) throw new Error(`Invalid resolver pattern '${resource}': empty placeholder name.`);
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid resolver pattern '${resource}': invalid placeholder name '${name}'.`);
            if (placeholders.has(name)) throw new Error(`Invalid resolver pattern '${resource}': duplicate placeholder '${name}'.`);
            placeholders.add(name);
            regexp += name === "name"
                ? `(?<name>[^/\\\\?#%]+?)`
                : name === "path"
                    ? `(?<path>[^/\\\\?#%]+(?:/[^/\\\\?#%]+)*?)`
                    : `(?<${name}>.+?)`;
            index = end + 1;
            previousTokenWasPlaceholder = true;
        }

        // Retain the original definition vocabulary alongside the compiled matcher.
        const definition = {resource, src: value.src, regexp: new RegExp(regexp + "$"), ...value};
        this.#definitions.push(definition);
    }
    has(resource) {
        // Match the logical value without query or fragment suffixes.
        resource = this.#removeSuffix(resource);
        return this.#definitions.some(definition => this.#matches(resource, definition));
    }
    resolve(resource) {
        // Prefer an exact definition before considering generic patterns.
        resource = this.#removeSuffix(resource);
        for (const definition of this.#definitions) {
            if (definition.resource === resource) return this.#createResult(definition);
        }

        // Resolve generic patterns in the established deterministic precedence order.
        for (let index = this.#definitions.length - 1; index >= 0; index--) {
            const definition = this.#definitions[index];
            const match = resource.match(definition.regexp);
            if (!match || !this.#isSafe(match.groups)) continue;
            return this.#createResult(definition, match.groups);
        }
        console.error(`resolver.resolveDefinition('${resource}'): unable to resolve`);
        return null;
    }

    // private methods
    #removeSuffix(resource) {
        // Preserve the existing Resolver behavior of removing fragments before queries.
        if (resource.indexOf("#") !== -1) resource = resource.split("#")[0];
        if (resource.indexOf("?") !== -1) resource = resource.split("?")[0];
        return resource;
    }
    #matches(resource, definition) {
        // Apply traversal restrictions after regular expression matching.
        const match = resource.match(definition.regexp);
        return Boolean(match && this.#isSafe(match.groups));
    }
    #isSafe(groups = {}) {
        // Restrict the special name and path placeholders while leaving generic captures compatible.
        return !Object.entries(groups ?? {}).some(([key, value]) => key === "name"
            ? value === "." || value === ".." || /[/\\?#%]/.test(value)
            : key === "path" && (/[\\?#%]/.test(value) || value.split("/").some(segment => !segment || segment === "." || segment === "..")));
    }
    #createResult(definition, groups = null) {
        // Normalize application paths and absolute URLs through the same rules.
        const isAbsoluteUrl = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(definition.src);
        let url = isAbsoluteUrl ? definition.src : new URL(definition.src.replace(/^\/+/, ""), this.#appBaseUrl).href;
        let path = isAbsoluteUrl ? null : definition.src;
        if (groups) {
            url = url.replaceAll("%7B", "{").replaceAll("%7D", "}");
            for (const [key, value] of Object.entries(groups)) {
                url = url.replaceAll(`{${key}}`, value);
                if (path !== null) path = path.replaceAll(`{${key}}`, value);
            }
        }
        return {definition, url, path};
    }
};
