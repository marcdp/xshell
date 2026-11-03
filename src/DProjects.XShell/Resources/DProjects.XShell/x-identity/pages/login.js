const FIELD_TYPES = new Set(["Title", "Paragraph", "Text", "Password", "Value"]);

function normalizeFields(fields) {
    if (!Array.isArray(fields)) throw new TypeError("Sign-in response fields must be an array.");
    return fields.map((field, index) => {
        if (!field || typeof field !== "object" || !FIELD_TYPES.has(field.type)) {
            throw new TypeError(`Sign-in response field at index ${index} is invalid.`);
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

export default {
    meta: {
        title: "Login",
        description: "Sign in using the fields requested by the configured identity provider."
    },
    template: `
        <section class="x-identity-card x-identity-login">
            <x-notice x-if="state.message" x-attr:type="state.messageType" x-attr:message="state.message"></x-notice>

            <div x-if="state.busy" class="x-identity-busy">
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

                <p class="x-identity-actions" x-if="state.canSubmit">
                    <x-button label="Continue" icon="x-key" command="submit" x-attr:disabled="state.busy"></x-button>
                </p>
                <p class="x-identity-actions" x-if="state.canRetry">
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
    controller({ state, signin, principal, navigation, page }) {
        const request = { headers: {} };
        const sensitiveHeaders = new Set();
        let activeController = null;
        let alive = true;

        const clearRequest = () => {
            for (const name of Object.keys(request.headers)) delete request.headers[name];
            sensitiveHeaders.clear();
        };
        const clearSensitiveHeaders = () => {
            for (const name of sensitiveHeaders) delete request.headers[name];
            sensitiveHeaders.clear();
        };

        const controller = {
            async load() {
                alive = true;
                await this.advance();
            },
            unload() {
                alive = false;
                activeController?.abort();
                clearRequest();
                state.fields = [];
            },
            async advance() {
                if (state.busy && activeController) return;
                activeController?.abort();
                activeController = new AbortController();
                state.busy = true;
                state.canSubmit = false;
                state.canRetry = false;
                state.message = "";
                try {
                    const response = await signin.signInAsync({ headers: { ...request.headers } }, activeController.signal);
                    clearSensitiveHeaders();
                    if (!alive) return;
                    await this.handleResponse(response);
                } catch (error) {
                    clearSensitiveHeaders();
                    if (!alive || error?.name === "AbortError") return;
                    state.fields = [];
                    state.messageType = "error";
                    state.message = error?.message || "The sign-in provider could not be reached.";
                } finally {
                    activeController = null;
                    if (alive) state.busy = false;
                }
            },
            async handleResponse(response) {
                if (!response || typeof response !== "object") {
                    throw new TypeError("The sign-in provider returned an invalid response.");
                }
                if (response.status === "DataRequired") {
                    const fields = normalizeFields(response.fields);
                    for (const field of fields) {
                        if (field.type === "Value" && field.name) request.headers[field.name] = field.value;
                    }
                    state.fields = fields;
                    state.canSubmit = true;
                    return;
                }
                if (response.status === "Failure") {
                    state.fields = [];
                    state.messageType = "error";
                    state.message = "Authentication failed. Check the supplied information and try again if the provider allows it.";
                    state.canRetry = headerIsTrue(response.headers?.retry);
                    const attempt = Number.parseInt(request.headers.attempt ?? "0", 10);
                    request.headers.attempt = String(Number.isFinite(attempt) ? attempt + 1 : 1);
                    return;
                }
                if (response.status === "Success") {
                    const identities = response.claimsPrincipal?.identities;
                    if (!Array.isArray(identities)) {
                        throw new TypeError("A successful sign-in response must contain claimsPrincipal.identities.");
                    }
                    principal.setIdentities(identities);
                    clearRequest();
                    state.fields = [];
                    await navigation.navigate({ href: "/account", page, open: "auto" });
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
                state.message = "";
                await this.advance();
            }
        };
        return controller;
    }
};
