const FIELD_TYPES = new Set(["Title", "Paragraph", "Text", "Password", "Value"]);
const RESPONSE_CONTROL_HEADERS = new Set(["retry"]);

function normalizeFields(fields) {
    if (!Array.isArray(fields)) throw new TypeError("Sign-in response fields must be an array.");
    return fields.map((field, index) => {
        if (!field || typeof field !== "object" || !FIELD_TYPES.has(field.type)) {
            throw new TypeError(`Sign-in response field at index ${index} is invalid.`);
        }
        if ((field.type === "Text" || field.type === "Password" || field.type === "Value") &&
            String(field.name ?? "").length === 0) {
            throw new TypeError(`Sign-in response field at index ${index} requires a name.`);
        }
        return {
            key: `${index}:${String(field.name ?? "")}`,
            name: String(field.name ?? ""),
            label: String(field.label ?? ""),
            type: field.type,
            description: String(field.description ?? ""),
            placeHolder: String(field.placeHolder ?? ""),
            required: field.required === true,
            value: field.type === "Password" ? "" : String(field.value ?? ""),
            inputType: field.type === "Password" ? "password" : "text"
        };
    });
}

function headerIsTrue(value) {
    return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
}

function validateClaimsPrincipal(value, source) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.identities)) {
        throw new TypeError(`${source} claimsPrincipal must contain an identities array.`);
    }
    value.identities.forEach((identity, identityIndex) => {
        if (!identity || typeof identity !== "object" || Array.isArray(identity) ||
            (identity.authenticationType !== null && typeof identity.authenticationType !== "string") ||
            !Array.isArray(identity.claims)) {
            throw new TypeError(`${source} identity at index ${identityIndex} is invalid.`);
        }
        identity.claims.forEach((claim, claimIndex) => {
            if (!claim || typeof claim !== "object" || Array.isArray(claim) ||
                typeof claim.type !== "string" || typeof claim.value !== "string") {
                throw new TypeError(`${source} claim at identity ${identityIndex}, index ${claimIndex} is invalid.`);
            }
        });
    });
    return value.identities;
}

function isAuthenticated(identities) {
    return identities.some(identity =>
        typeof identity.authenticationType === "string" && identity.authenticationType.trim().length > 0
    );
}

function errorMessage(error) {
    switch (error?.name) {
        case "IdentityConfigurationError":
            return "Authentication endpoints are not configured for this application.";
        case "SignInProtocolError":
        case "SessionProtocolError":
        case "TypeError":
            return "The authentication server returned an invalid response.";
        case "SignInHttpError":
        case "SessionHttpError":
            return "The authentication server rejected the request.";
        default:
            return "The authentication server could not be reached.";
    }
}

export default {
    meta: {
        title: "Login",
        description: "Sign in using the fields requested by the configured identity provider."
    },
    template: `
        <section>
            <x-notice x-if="state.message" x-attr:type="state.messageType" x-attr:message="state.message"></x-notice>

            <div x-if="state.busy">
                <x-loading></x-loading>
                <p>Contacting the sign-in provider…</p>
            </div>

            <div x-else>
                <div x-for="field in state.fields" x-key="key">
                    <h2 x-if="field.type == 'Title'">{{ field.label || field.description || field.value }}</h2>
                    <p x-elseif="field.type == 'Paragraph'">{{ field.description || field.label || field.value }}</p>
                    <x-datafield
                        x-elseif="field.type == 'Text' || field.type == 'Password'"
                        x-attr:type="field.inputType"
                        x-attr:label="field.label"
                        x-attr:description="field.description"
                        x-attr:placeholder="field.placeHolder"
                        x-attr:required="field.required"
                        x-model="field.value">
                    </x-datafield>
                </div>

                <p x-if="state.canSubmit">
                    <x-button label="Continue" icon="x-key" command="submit" x-attr:disabled="state.busy"></x-button>
                </p>
                <p x-if="state.canRetry">
                    <x-button label="Try again" icon="x-key" command="retry" x-attr:disabled="state.busy"></x-button>
                </p>
            </div>
        </section>
    `,
    state: {
        busy: true,
        fields: [],
        message: "",
        messageType: "info",
        canSubmit: false,
        canRetry: false
    },
    controller({ state, signin, session, principal, navigation, page }) {
        const request = { headers: {} };
        const sensitiveHeaders = new Set();
        const continuationHeaders = new Set();
        let activeController = null;
        let alive = true;
        let operationId = 0;
        let retryAfterFailure = false;

        const clearRequest = () => {
            for (const name of Object.keys(request.headers)) delete request.headers[name];
            sensitiveHeaders.clear();
            continuationHeaders.clear();
        };
        const clearSensitiveHeaders = () => {
            for (const name of sensitiveHeaders) delete request.headers[name];
            sensitiveHeaders.clear();
        };
        const updateContinuationHeaders = headers => {
            for (const name of continuationHeaders) delete request.headers[name];
            continuationHeaders.clear();
            for (const [name, value] of Object.entries(headers || {})) {
                if (RESPONSE_CONTROL_HEADERS.has(name)) continue;
                request.headers[name] = value;
                continuationHeaders.add(name);
            }
        };

        const controller = {
            async load() {
                alive = true;
                await this.advance();
            },
            unload() {
                alive = false;
                operationId++;
                activeController?.abort();
                activeController = null;
                clearRequest();
                state.fields = [];
            },
            async advance() {
                if (activeController) return;
                const currentId = ++operationId;
                const currentController = new AbortController();
                activeController = currentController;
                state.busy = true;
                state.canSubmit = false;
                state.canRetry = false;
                state.message = "";
                try {
                    const response = await signin.signInAsync({ headers: { ...request.headers } }, currentController.signal);
                    clearSensitiveHeaders();
                    if (!alive || currentId !== operationId) return;
                    await this.handleResponse(response, currentController.signal);
                } catch (error) {
                    clearSensitiveHeaders();
                    if (!alive || currentId !== operationId || currentController.signal.aborted || error?.name === "AbortError") return;
                    state.fields = [];
                    state.messageType = "error";
                    state.message = errorMessage(error);
                    state.canRetry = error?.name === "SignInNetworkError" || error?.name === "SignInHttpError" ||
                        error?.name === "SessionNetworkError" || error?.name === "SessionHttpError";
                    retryAfterFailure = false;
                } finally {
                    if (activeController === currentController) activeController = null;
                    if (alive && currentId === operationId) state.busy = false;
                }
            },
            async handleResponse(response, signal) {
                if (response.status === "DataRequired") {
                    updateContinuationHeaders(response.headers);
                    const fields = normalizeFields(response.fields);
                    for (const field of fields) {
                        if (field.type === "Value" && field.name) request.headers[field.name] = field.value;
                        if (field.type === "Password") delete request.headers[field.name];
                    }
                    state.fields = fields;
                    state.canSubmit = true;
                    retryAfterFailure = false;
                    return;
                }
                if (response.status === "Failure") {
                    updateContinuationHeaders(response.headers);
                    state.fields = [];
                    state.messageType = "error";
                    state.message = "Authentication failed.";
                    state.canRetry = headerIsTrue(response.headers?.retry);
                    retryAfterFailure = state.canRetry;
                    if (!state.canRetry) clearRequest();
                    return;
                }
                if (response.status === "Success") {
                    const signInIdentities = validateClaimsPrincipal(response.claimsPrincipal, "Successful sign-in response");
                    if (!isAuthenticated(signInIdentities)) {
                        throw new TypeError("Successful sign-in response is not authenticated.");
                    }
                    const restored = await session.restoreAsync(signal);
                    const identities = validateClaimsPrincipal(restored.claimsPrincipal, "Restored session");
                    if (!isAuthenticated(identities)) throw new TypeError("The authenticated server session was not established.");
                    principal.setIdentities(identities);
                    clearRequest();
                    state.fields = [];
                    await navigation.navigate({ href: "page:x-identity:/pages/account.js", page, open: "auto" });
                    return;
                }
                throw new TypeError(`Unknown sign-in response status '${response.status}'.`);
            },
            async submit() {
                if (state.busy) return;
                let missing = false;
                for (const field of state.fields) {
                    if (field.type !== "Text" && field.type !== "Password") continue;
                    if (field.required && field.value.length === 0) missing = true;
                    request.headers[field.name] = field.value;
                    if (field.type === "Password") {
                        sensitiveHeaders.add(field.name);
                        field.value = "";
                    }
                }
                if (missing) {
                    clearSensitiveHeaders();
                    state.messageType = "warning";
                    state.message = "Complete all required fields before continuing.";
                    return;
                }
                await this.advance();
            },
            async retry() {
                if (state.busy) return;
                clearSensitiveHeaders();
                if (retryAfterFailure) {
                    const attempt = Number.parseInt(request.headers.attempt ?? "0", 10);
                    request.headers.attempt = String(Number.isFinite(attempt) ? attempt + 1 : 1);
                }
                retryAfterFailure = false;
                state.message = "";
                await this.advance();
            }
        };
        return controller;
    }
};
