export default {
    meta: {
        title: "Account"
    },
    template: `
        <section class="x-identity-shortcuts">
            <div x-if="state.isAuthenticated">
                <x-button class="anchor" label="Account" icon="x-key" command="account"></x-button>
                <x-button class="anchor" label="Logout" icon="x-logout" command="logout"></x-button>
                <p class="x-identity-local-note">Logout currently clears only the browser-side principal. A provider must revoke any server session.</p>
            </div>
            <x-button x-else class="anchor" label="Login" icon="x-key" command="login"></x-button>
        </section>
    `,
    state: {
        isAuthenticated: false
    },
    controller({ state, principal, bus, events, navigation, page }) {
        return {
            load() {
                events.on(bus, "x-identity:principal:changed", "refresh");
                this.refresh();
            },
            refresh() {
                state.isAuthenticated = principal.isAuthenticated;
            },
            login() {
                navigation.navigate({ href: "/login", page, open: "top" });
            },
            account() {
                navigation.navigate({ href: "/account", page, open: "top" });
            },
            logout() {
                // This is intentionally local-only until a provider supplies real
                // session invalidation. It does not claim to revoke server state.
                principal.clear();
            }
        };
    }
};
