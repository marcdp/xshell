const FIELD_TYPES = Object.freeze(["Title", "Paragraph", "Text", "Password", "Value"]);

function abortError() {
    if (typeof DOMException === "function") return new DOMException("The sign-in operation was aborted.", "AbortError");
    const error = new Error("The sign-in operation was aborted.");
    error.name = "AbortError";
    return error;
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw signal.reason ?? abortError();
}

function wait(delay, signal) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(done, delay);
        function done() {
            signal?.removeEventListener?.("abort", aborted);
            resolve();
        }
        function aborted() {
            clearTimeout(timeout);
            reject(signal.reason ?? abortError());
        }
        signal?.addEventListener?.("abort", aborted, { once: true });
    });
}

function field(name, label, type, options = {}) {
    if (!FIELD_TYPES.includes(type)) throw new TypeError(`Unsupported sign-in field type '${type}'.`);
    return {
        name,
        label,
        type,
        description: options.description ?? "",
        placeHolder: options.placeHolder ?? "",
        required: options.required ?? false,
        value: options.value ?? ""
    };
}

function dataRequired(fields) {
    return { status: "DataRequired", headers: {}, fields, claimsPrincipal: null };
}

export default class SignIn {

    async signInAsync(request, signal) {
        throwIfAborted(signal);
        if (!request || typeof request !== "object" || Array.isArray(request)) {
            throw new TypeError("Sign-in request must be an object.");
        }
        if (!request.headers || typeof request.headers !== "object" || Array.isArray(request.headers)) {
            throw new TypeError("Sign-in request headers must be an object.");
        }
        for (const [name, value] of Object.entries(request.headers)) {
            if (typeof value !== "string") {
                throw new TypeError(`Sign-in request header '${name}' must be a string.`);
            }
        }

        const login = request.headers.login;
        if (typeof login !== "string" || login.length === 0) {
            return dataRequired([
                field("login", "Login", "Text", {
                    description: "Enter the login identifier expected by the configured provider.",
                    placeHolder: "Enter your login",
                    required: true
                })
            ]);
        }

        const password = request.headers.password;
        if (typeof password !== "string" || password.length === 0) {
            return dataRequired([
                field("password", "Password", "Password", {
                    description: "Enter the credential expected by the configured provider.",
                    placeHolder: "Enter your password",
                    required: true
                })
            ]);
        }

        // Keep the default provider visibly asynchronous while remaining cancellable.
        // Credentials are inspected only for presence and are never retained.
        await wait(150, signal);
        throwIfAborted(signal);
        return {
            status: "Failure",
            headers: { retry: "true" },
            fields: [],
            claimsPrincipal: null
        };
    }
}
