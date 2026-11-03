const SAFE_CLAIM_TYPES = new Set([
    "name",
    "sub",
    "nameidentifier",
    "email",
    "role",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
]);

function snapshot(principal) {
    return principal.identities.map((identity, index) => ({
        index: index + 1,
        authenticationType: identity.authenticationType || "Not authenticated",
        claims: identity.claims
            .filter(claim => SAFE_CLAIM_TYPES.has(claim.type))
            .map(claim => ({ type: claim.type, value: claim.value }))
    }));
}

export default {
    meta: {
        title: "Account",
        description: "Claims and identities associated with the current application principal."
    },
    template: `
        <section>
            <div x-if="state.status == 'initializing'">
                <x-loading></x-loading>
                <p>Loading the current session…</p>
            </div>
            <x-notice
                x-elseif="state.status == 'error'"
                type="error"
                label="Account unavailable"
                message="The current session could not be loaded.">
            </x-notice>
            <p x-if="state.status == 'error'">
                <x-button label="Retry" icon="x-key" command="retry" x-attr:disabled="state.busy"></x-button>
            </p>

            <x-notice
                x-if="state.status == 'anonymous'"
                type="info"
                label="Anonymous"
                message="No authenticated server session is available.">
            </x-notice>
            <p x-if="state.status == 'anonymous'">
                <x-button label="Login" icon="x-key" command="login"></x-button>
            </p>

            <div x-if="state.isAuthenticated">
                <p><strong>Authentication state:</strong> Authenticated</p>
                <article x-for="identity in state.identities" x-key="index">
                    <h2>Identity {{ identity.index }}</h2>
                    <p><strong>Authentication type:</strong> {{ identity.authenticationType }}</p>
                    <dl x-if="identity.claims.length">
                        <div x-for="claim in identity.claims">
                            <dt>{{ claim.type }}</dt>
                            <dd>{{ claim.value }}</dd>
                        </div>
                    </dl>
                    <p x-else>No non-sensitive claims are available for this identity.</p>
                </article>
            </div>
        </section>
    `,
    state: {
        status: "initializing",
        isAuthenticated: false,
        identities: [],
        busy: false
    },
    controller({ state, principal, session, bus, events, navigation, page }) {
        let activeController = null;
        let alive = true;
        const applySession = response => {
            if (response.claimsPrincipal === null) principal.clear();
            else principal.setIdentities(response.claimsPrincipal.identities);
        };
        const controller = {
            load() {
                alive = true;
                events.on(bus, "x-identity:principal:changed", "refresh");
                this.refresh();
            },
            unload() {
                alive = false;
                activeController?.abort();
                activeController = null;
            },
            refresh() {
                state.status = principal.status;
                state.isAuthenticated = principal.isAuthenticated;
                state.identities = snapshot(principal);
            },
            login() {
                navigation.navigate({ href: "page:x-identity:/pages/login.js", page, open: "auto" });
            },
            async retry() {
                if (state.busy) return;
                const currentController = new AbortController();
                activeController = currentController;
                state.busy = true;
                principal.setInitializing();
                try {
                    const response = await session.restoreAsync(currentController.signal);
                    if (alive && activeController === currentController) applySession(response);
                } catch (error) {
                    if (alive && !currentController.signal.aborted && error?.name !== "AbortError") principal.setError();
                } finally {
                    if (activeController === currentController) activeController = null;
                    if (alive) state.busy = false;
                }
            }
        };
        return controller;
    }
};
