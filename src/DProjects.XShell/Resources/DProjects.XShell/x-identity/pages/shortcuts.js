export default {
    meta: {
        title: "Account"
    },
    template: `
        <section>
            <x-button x-if="state.status == 'initializing'" label="Loading" icon="x-key" disabled></x-button>
            <div x-elseif="state.status == 'error'">
                <x-notice type="error" label="Account unavailable" message="The current session could not be loaded."></x-notice>
                <x-button label="Retry" icon="x-key" command="retry" x-attr:disabled="state.busy"></x-button>
            </div>
            <div x-elseif="state.isAuthenticated">
                <x-notice x-if="state.message" type="error" x-attr:message="state.message"></x-notice>
                <x-button class="anchor" label="Account" icon="x-key" command="account"></x-button>
                <x-button class="anchor" label="Logout" icon="x-logout" command="logout" x-attr:disabled="state.busy"></x-button>
            </div>
            <x-button x-else label="Login" icon="x-key" command="login"></x-button>
        </section>
    `,
    state: {
        status: "initializing",
        isAuthenticated: false,
        busy: false,
        message: ""
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
            },
            login() {
                navigation.navigate({ href: "page:x-identity:/pages/login.js", page, open: "top" });
            },
            account() {
                navigation.navigate({ href: "page:x-identity:/pages/account.js", page, open: "top" });
            },
            async logout() {
                if (state.busy) return;
                const currentController = new AbortController();
                activeController = currentController;
                state.busy = true;
                state.message = "";
                try {
                    await session.signOutAsync(currentController.signal);
                } catch (error) {
                    if (alive && !currentController.signal.aborted && error?.name !== "AbortError") {
                        state.message = "The server session could not be ended. You are still signed in.";
                    }
                } finally {
                    if (activeController === currentController) activeController = null;
                    if (alive) state.busy = false;
                }
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
