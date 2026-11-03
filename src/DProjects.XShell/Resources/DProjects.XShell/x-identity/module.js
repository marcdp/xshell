export default class IdentityModule {

    constructor({ principal, session }) {
        this._principal = principal;
        this._session = session;
        this._controller = null;
    }

    async start() {
        this._controller?.abort();
        this._controller = new AbortController();
        this._principal.setInitializing();

        const timeoutError = new Error("Session restoration timed out.");
        timeoutError.name = "SessionTimeoutError";
        const timeout = setTimeout(() => this._controller?.abort(timeoutError), 10000);
        try {
            const response = await this._session.restoreAsync(this._controller.signal);
            if (response.claimsPrincipal === null) this._principal.clear();
            else this._principal.setIdentities(response.claimsPrincipal.identities);
        } catch {
            this._principal.setError();
        } finally {
            clearTimeout(timeout);
            this._controller = null;
        }
    }

    stop() {
        this._controller?.abort();
        this._controller = null;
    }
}
