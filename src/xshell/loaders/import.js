//export 
export default {
    load: async (src) => {
        // dynamic import of a module
        let module = await import(src);
        return module.default;
    }
};