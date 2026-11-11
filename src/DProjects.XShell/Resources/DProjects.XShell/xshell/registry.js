export default class Registry {

    // vars
    _items = null;

    // ctor
    constructor({ config }) {
        this._items = config.xshell.registry;
    }

    // props
    get registry() {
        return Object.freeze(Object.fromEntries(
            Object.entries(this._items).map(([name, item]) => [
                name,
                Object.freeze({
                    schema: item.schema,
                    contributions: item.contributions ?? []
                })
            ])
        ));
    }

    // methods
    has(name) {
        return Object.hasOwn(this._items, name);
    }
    get(name) {
        return this._items[name];
    }
}