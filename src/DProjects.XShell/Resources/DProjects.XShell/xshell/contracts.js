import { deepFreeze } from "./utils/object.js";
import JsonValidator from "./services/json-validator.js"
import xshell from "./xshell.js";

// utils
async function validateServiceContract(src, definition) {
    // use loader to load schema
    const contractServiceSchema = await xshell.loader.load("schema:service");
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const result = new JsonValidator().validate(definitionObject, contractServiceSchema);
    if (!result.valid) {
        console.error(`Invalid contract: ${src}`, result.errors);
        throw new Error(`Invalid contract: ${src}`, { cause: result.errors });
    }
    // resolve contract-local named type references after structural validation
    const references = [];
    for (const [name, descriptor] of Object.entries(definitionObject.properties || {})) {
        references.push([descriptor, `properties.${name}.ref`]);
    }
    for (const [methodName, method] of Object.entries(definitionObject.methods || {})) {
        for (const [index, parameter] of (method.parameters || []).entries()) {
            references.push([parameter, `methods.${methodName}.parameters[${index}].ref`]);
        }
        if (method.returns) references.push([method.returns, `methods.${methodName}.returns.ref`]);
    }
    for (const [eventName, event] of Object.entries(definitionObject.events || {})) {
        for (const [name, descriptor] of Object.entries(event.detail || {})) {
            references.push([descriptor, `events.${eventName}.detail.${name}.ref`]);
        }
    }
    for (const [descriptor, location] of references) {
        if (descriptor.ref !== undefined && !Object.hasOwn(definitionObject.types || {}, descriptor.ref)) {
            const error = new Error(`Undefined type reference '${descriptor.ref}' at '${location}'.`);
            console.error(`Invalid contract: ${src}`, error.message);
            throw new Error(`Invalid contract: ${src}: ${error.message}`, { cause: error });
        }
    }
}


// class
export default class Contracts {

    //vars
    _config = null;
    _loader = null;
    _items = null;
    
    // props
    get registry() {
        // expose contract metadata without returning mutable contract documents
        return Object.freeze(Object.values(this._items || {}).map(item => Object.freeze({
            id: item.id,
            url: item.url,
            path: item.path,
            moduleId: item.moduleId,
            label: item.contract.label || "",
            description: item.contract.description || "",
            icon: item.contract.icon || null,
            size: item.size,
            status: item.status,
            time: item.time
        })));
    }

    // ctor
    constructor( { config, loader } ) {
        this._config = config;
        this._loader = loader;
    }   


    // methods
    async init() {
        // process framework and module contracts
        let tasks = [];
        const frameworkAssetsPath = this._config.xshell?.assets?.path;
        if (frameworkAssetsPath) {
            const frameworkContractsPath = frameworkAssetsPath + "/contracts";
            for (const file of this._config.xshell.files ?? []) {
                if (file.path.startsWith(frameworkContractsPath + "/") && file.path.endsWith(".json")) {
                    const contractId = file.path.substring(frameworkContractsPath.length + 1, file.path.length - ".json".length);
                    const fileUrl = new URL(file.path.replace(/^\/+/, ""),this._config.app.baseUrl).href;
                    tasks.push(this._processContractFile(contractId, fileUrl, file, "xshell", file.size));
                }
            }
        }
        for (const moduleId of Object.keys(this._config.modules)) {
            const module = this._config.modules[moduleId];
            const moduleContractsPath = module.assets.path + "/contracts";
            for (const file of Object.values(module.files)) {
                if (file.path.startsWith(moduleContractsPath + "/") && file.path.endsWith(".json")) {
                    const contractId = file.path.substring(moduleContractsPath.length + 1, file.path.length - ".json".length);
                    const fileUrl = new URL(file.path.replace(/^\/+/, ""),this._config.app.baseUrl).href;
                    tasks.push(this._processContractFile(contractId, fileUrl, file, moduleId, file.size));
                }
            }
        }
        const contractFiles = await Promise.all(tasks); // contracts is a list [{id:...,contract:...},{id:,contract:...},...]
        // convert the list of contracts into a cache object keyed by contract id
        const items = {};
        for (const contractFile of contractFiles) {
            if (items[contractFile.id]) {
                const first = items[contractFile.id];
                throw new Error(`Duplicate contract '${contractFile.id}' declared by module '${first.moduleId}' in '${first.path}' and module '${contractFile.moduleId}' in '${contractFile.path}'.`);
            }
            items[contractFile.id] = Object.freeze(contractFile);
        }
        this._items = Object.freeze(items);
    }
    getContractItemById(id) {
        return this._items ? this._items[id] : undefined;
    }
    getContractById(id){
        const item = this.getContractItemById(id);
        return item ? item.contract : undefined;
    }


    // process a single contract file
    async _processContractFile(id, url, file, moduleId, size) {
        const start = performance.now();
        const contract = await this._loader.load("contract:" + id);
        await validateServiceContract(url, contract);
        deepFreeze(contract);
        return {
            id: id,
            url: url,
            path: file.path,
            moduleId: moduleId,
            contract: contract,
            size: size,
            status: "loaded",
            time: performance.now() - start
        };
    }
    
}
