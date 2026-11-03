const SENSITIVE_CLAIM_PATTERN = /(password|secret|token|credential)/i;

function snapshot(principal) {
    return principal.identities.map((identity, index) => ({
        index: index + 1,
        authenticationType: identity.authenticationType || "Not authenticated",
        claims: identity.claims
            .filter(claim => !SENSITIVE_CLAIM_PATTERN.test(claim.type))
            .map(claim => ({ type: claim.type, value: claim.value }))
    }));
}

export default {
    meta: {
        title: "Account",
        description: "Claims and identities associated with the current application principal."
    },
    template: `
        <section class="x-identity-card x-identity-account">
            <x-notice
                x-if="!state.isAuthenticated"
                type="info"
                label="Anonymous"
                message="No authenticated identity is available in this browser session.">
            </x-notice>
            <p class="x-identity-actions" x-if="!state.isAuthenticated">
                <x-button label="Login" icon="x-key" command="login"></x-button>
            </p>

            <div x-else>
                <p><strong>Authentication state:</strong> Authenticated</p>
                <article class="x-identity-identity" x-for="identity in state.identities" x-key="index">
                    <h2>Identity {{ identity.index }}</h2>
                    <p><strong>Authentication type:</strong> {{ identity.authenticationType }}</p>
                    <dl x-if="identity.claims.length" class="x-identity-claims">
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
        isAuthenticated: false,
        identities: []
    },
    controller({ state, principal, bus, events, navigation, page }) {
        return {
            load() {
                events.on(bus, "x-identity:principal:changed", "refresh");
                this.refresh();
            },
            refresh() {
                state.isAuthenticated = principal.isAuthenticated;
                state.identities = snapshot(principal);
            },
            login() {
                navigation.navigate({ href: "/login", page, open: "auto" });
            }
        };
    }
};
