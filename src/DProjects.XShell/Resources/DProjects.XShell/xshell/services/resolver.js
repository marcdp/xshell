

import ResourcePatternResolver from "../utils/resource-pattern-resolver.js";

// class
export default class Resolver {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
        },
        additionalProperties: false
    };


    //vars
    #patterns;
    

    //ctor
    constructor( { config }, options) {
        // Flatten global resource categories into the shared pattern matcher.
        const definitions = {};
        for (const [type, patterns] of Object.entries(config.xshell.resolver)) {
            for (const [pattern, definition] of Object.entries(patterns)) definitions[`${type}:${pattern}`] = definition;
        }
        this.#patterns = new ResourcePatternResolver(config.app.baseUrl, definitions);
    }

    // props
    get registry() {
        return this.#patterns.registry;
    }

    //methods
    addDefinition(resource, value) {
        this.#patterns.addDefinition(resource, value);
    }
    has(resource) {
        return this.#patterns.has(resource);
    }
    resolve(resource) {
        const result = this.#patterns.resolve(resource);
        if (result) return result;
        console.error(`resolver.resolveDefinition('${resource}'): unable to resolve`);
        return null;
    }
};
