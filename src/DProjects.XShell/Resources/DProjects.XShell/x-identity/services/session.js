function configurationError(message, options) {
    const error = new Error(message, options);
    error.name = "IdentityConfigurationError";
    return error;
}

function protocolError(message, options) {
    const error = new Error(message, options);
    error.name = "SessionProtocolError";
    return error;
}

function resolveEndpoint(config, parameterName) {
    const value = config.modules?.["x-identity"]?.params?.[parameterName];
    if (typeof value !== "string" || value.trim().length === 0) {
        throw configurationError(`The x-identity ${parameterName} module parameter is not configured.`);
    }
    try {
        const url = /^[a-z][a-z0-9+.-]*:/i.test(value)
            ? new URL(value)
            : new URL(value.replace(/^\/+/, ""), config.app.baseUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol.");
        return url.href;
    } catch (cause) {
        throw configurationError(`The x-identity ${parameterName} module parameter is not a valid HTTP(S) URL.`, { cause });
    }
}

function validateClaimsPrincipal(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.identities)) {
        throw protocolError("Session claimsPrincipal must contain an identities array.");
    }
    value.identities.forEach((identity, identityIndex) => {
        if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
            throw protocolError(`Session identity at index ${identityIndex} must be an object.`);
        }
        if (identity.authenticationType !== null && typeof identity.authenticationType !== "string") {
            throw protocolError(`Session identity at index ${identityIndex} has an invalid authenticationType.`);
        }
        if (!Array.isArray(identity.claims)) {
            throw protocolError(`Session identity at index ${identityIndex} must contain a claims array.`);
        }
        identity.claims.forEach((claim, claimIndex) => {
            if (!claim || typeof claim !== "object" || Array.isArray(claim) ||
                typeof claim.type !== "string" || typeof claim.value !== "string") {
                throw protocolError(`Session claim at identity ${identityIndex}, index ${claimIndex} is invalid.`);
            }
        });
    });
}

function validateSessionResponse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !Object.hasOwn(value, "claimsPrincipal")) {
        throw protocolError("Session response must contain claimsPrincipal.");
    }
    if (value.claimsPrincipal !== null) validateClaimsPrincipal(value.claimsPrincipal);
    return value;
}

async function fetchEndpoint(url, options, signal, operationName) {
    let response;
    try {
        response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal, ...options });
    } catch (cause) {
        if (signal?.aborted) throw signal.reason ?? cause;
        const error = new Error(`The ${operationName} endpoint could not be reached.`, { cause });
        error.name = "SessionNetworkError";
        throw error;
    }
    if (!response.ok) {
        const error = new Error(`The ${operationName} endpoint returned HTTP ${response.status}.`);
        error.name = "SessionHttpError";
        error.status = response.status;
        throw error;
    }
    return response;
}

export default class Session {

    constructor({ config, principal }) {
        this._config = config;
        this._principal = principal;
    }

    async restoreAsync(signal) {
        const response = await fetchEndpoint(resolveEndpoint(this._config, "sessionUrl"), {
            method: "GET",
            headers: { "Accept": "application/json" }
        }, signal, "session");
        let value;
        try {
            value = await response.json();
        } catch (cause) {
            throw protocolError("The session endpoint did not return a valid JSON response.", { cause });
        }
        return validateSessionResponse(value);
    }

    async signOutAsync(signal) {
        await fetchEndpoint(resolveEndpoint(this._config, "signoutUrl"), {
            method: "POST",
            headers: { "Accept": "application/json" }
        }, signal, "sign-out");
        this._principal.clear();
    }
}
