const ROLE_CLAIM_TYPE = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

function cloneAndFreezeIdentities(identities) {
    return Object.freeze(identities.map(identity => Object.freeze({
        authenticationType: identity.authenticationType,
        claims: Object.freeze(identity.claims.map(claim => Object.freeze({
            type: claim.type,
            value: claim.value
        })))
    })));
}

function normalizeIdentities(identities) {
    if (!Array.isArray(identities)) {
        throw new TypeError("Principal identities must be an array.");
    }

    const normalized = identities.map((identity, identityIndex) => {
        if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
            throw new TypeError(`Principal identity at index ${identityIndex} must be an object.`);
        }
        if (identity.authenticationType !== null && typeof identity.authenticationType !== "string") {
            throw new TypeError(`Principal identity at index ${identityIndex} has an invalid authenticationType.`);
        }
        if (!Array.isArray(identity.claims)) {
            throw new TypeError(`Principal identity at index ${identityIndex} must contain a claims array.`);
        }

        const claims = identity.claims.map((claim, claimIndex) => {
            if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
                throw new TypeError(`Claim at identity ${identityIndex}, index ${claimIndex} must be an object.`);
            }
            if (typeof claim.type !== "string" || typeof claim.value !== "string") {
                throw new TypeError(`Claim at identity ${identityIndex}, index ${claimIndex} must contain string type and value properties.`);
            }
            return { type: claim.type, value: claim.value };
        });

        return {
            authenticationType: identity.authenticationType,
            claims
        };
    });

    return cloneAndFreezeIdentities(normalized);
}

export default class Principal {

    constructor({ bus }) {
        this._bus = bus;
        this._identities = Object.freeze([]);
        this._status = "initializing";
        this._serialized = JSON.stringify({ status: this._status, identities: [] });
    }

    get identities() {
        return cloneAndFreezeIdentities(this._identities);
    }

    get identity() {
        return this.identities[0] ?? null;
    }

    get isAuthenticated() {
        return this._identities.some(identity =>
            typeof identity.authenticationType === "string" && identity.authenticationType.trim().length > 0
        );
    }

    get status() {
        return this._status;
    }

    hasClaim(type, value) {
        if (typeof type !== "string") throw new TypeError("Claim type must be a string.");
        if (typeof value !== "undefined" && typeof value !== "string") {
            throw new TypeError("Claim value must be a string when supplied.");
        }
        return this._identities.some(identity => identity.claims.some(claim =>
            claim.type === type && (typeof value === "undefined" || claim.value === value)
        ));
    }

    isInRole(role) {
        if (typeof role !== "string") throw new TypeError("Role must be a string.");
        return this.hasClaim(ROLE_CLAIM_TYPE, role);
    }

    setIdentities(identities) {
        const normalized = normalizeIdentities(identities);
        const status = normalized.some(identity =>
            typeof identity.authenticationType === "string" && identity.authenticationType.trim().length > 0
        ) ? "authenticated" : "anonymous";
        this._replace(normalized, status);
    }

    setInitializing() {
        this._replace(Object.freeze([]), "initializing");
    }

    setError() {
        this._replace(Object.freeze([]), "error");
    }

    clear() {
        this._replace(Object.freeze([]), "anonymous");
    }

    _replace(identities, status) {
        const serialized = JSON.stringify({ status, identities });
        if (serialized === this._serialized) return;

        this._identities = identities;
        this._status = status;
        this._serialized = serialized;
        this._bus.emit("x-identity:principal:changed", {
            isAuthenticated: this.isAuthenticated,
            status: this.status
        });
    }
}
