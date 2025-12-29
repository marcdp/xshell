// vars
let _identity = null;
let _initialized = false;

// default export, a proxy to the identity object
export default new Proxy({}, {
    get(_target, prop) {
        if (!_initialized) {
            throw new Error(`Identity accessed before initialization (property: ${String(prop)})`);
        }
        return _identity[prop];
    },
    set() {
        throw new Error("Identity is read-only");
    },
    deleteProperty() {
        throw new Error("Identity is read-only");
    },
    has(_target, prop) {
        return _initialized && prop in _identity;
    },
    ownKeys() {
        return _initialized ? Reflect.ownKeys(_identity) : [];
    }
});

// function to initialize the identity
export function identityInit(identity) {
    if (_initialized) throw new Error("Identity has already been initialized");
    if (!identity || typeof identity !== "object") throw new Error("Invalid identity object");
    const {
        id,
        name,
        roles = [],
        claims = {}
    } = identity;
    if (!id) throw new Error("Identity.id is required");
    _identity = Object.freeze({
        id,
        name: name ?? id,
        roles: Object.freeze([...roles]),
        claims: Object.freeze({ ...claims })
    });
    _initialized = true;
}

