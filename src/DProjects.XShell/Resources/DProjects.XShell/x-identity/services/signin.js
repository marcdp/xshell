const FIELD_TYPES = new Set(["Title", "Paragraph", "Text", "Password", "Value"]);
const STATUSES = new Set(["DataRequired", "Failure", "Success"]);

function configurationError(message, options) {
    const error = new Error(message, options);
    error.name = "IdentityConfigurationError";
    return error;
}

function protocolError(message, options) {
    const error = new Error(message, options);
    error.name = "SignInProtocolError";
    return error;
}

function validateStringMap(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw protocolError(`${name} must be an object.`);
    }
    for (const [key, item] of Object.entries(value)) {
        if (typeof item !== "string") throw protocolError(`${name} '${key}' must be a string.`);
    }
}

function validateRequest(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        throw new TypeError("Sign-in request must be an object.");
    }
    if (!request.headers || typeof request.headers !== "object" || Array.isArray(request.headers)) {
        throw new TypeError("Sign-in request headers must be an object.");
    }
    for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value !== "string") throw new TypeError(`Sign-in request header '${name}' must be a string.`);
    }
}

function validateField(field, index) {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
        throw protocolError(`Sign-in response field at index ${index} must be an object.`);
    }
    for (const name of ["name", "label", "description", "placeHolder", "value"]) {
        if (typeof field[name] !== "string") {
            throw protocolError(`Sign-in response field at index ${index} has an invalid '${name}'.`);
        }
    }
    if (!FIELD_TYPES.has(field.type)) {
        throw protocolError(`Sign-in response field at index ${index} has unsupported type '${field.type}'.`);
    }
    if (typeof field.required !== "boolean") {
        throw protocolError(`Sign-in response field at index ${index} has an invalid 'required' value.`);
    }
}

function validateResponse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw protocolError("Sign-in response must be an object.");
    }
    if (!STATUSES.has(value.status)) {
        throw protocolError(`Sign-in response has unsupported status '${value.status}'.`);
    }
    validateStringMap(value.headers, "Sign-in response headers");
    if (!Array.isArray(value.fields)) throw protocolError("Sign-in response fields must be an array.");
    value.fields.forEach(validateField);
    if (value.claimsPrincipal !== null &&
        (!value.claimsPrincipal || typeof value.claimsPrincipal !== "object" || Array.isArray(value.claimsPrincipal))) {
        throw protocolError("Sign-in response claimsPrincipal must be an object or null.");
    }
    return value;
}

function resolveEndpoint(config) {
    const value = config.modules?.["x-identity"]?.params?.signinUrl;
    if (typeof value !== "string" || value.trim().length === 0) {
        throw configurationError("The x-identity signinUrl module parameter is not configured.");
    }
    try {
        const url = /^[a-z][a-z0-9+.-]*:/i.test(value)
            ? new URL(value)
            : new URL(value.replace(/^\/+/, ""), config.app.baseUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol.");
        return url.href;
    } catch (cause) {
        throw configurationError("The x-identity signinUrl module parameter is not a valid HTTP(S) URL.", { cause });
    }
}

export default class SignIn {

    constructor({ config }) {
        this._config = config;
    }

    async signInAsync(request, signal) {
        validateRequest(request);
        const url = resolveEndpoint(this._config);
        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(request),
                signal
            });
        } catch (cause) {
            if (signal?.aborted) throw signal.reason ?? cause;
            const error = new Error("The sign-in endpoint could not be reached.", { cause });
            error.name = "SignInNetworkError";
            throw error;
        }

        if (!response.ok) {
            const error = new Error(`The sign-in endpoint returned HTTP ${response.status}.`);
            error.name = "SignInHttpError";
            error.status = response.status;
            throw error;
        }

        let value;
        try {
            value = await response.json();
        } catch (cause) {
            throw protocolError("The sign-in endpoint did not return a valid JSON response.", { cause });
        }
        return validateResponse(value);
    }
}
