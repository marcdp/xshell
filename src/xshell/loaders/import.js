//export 
export default class LoaderImport {
    async load(src) {
        // dynamic import of a module
        let module = await import(src);
        return module.default;
    }
};