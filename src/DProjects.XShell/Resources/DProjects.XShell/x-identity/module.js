export default class IdentityModule {

    constructor({ principal }) {
        this._principal = principal;
    }

    async start() {
        // Session restoration is deliberately outside this initial module. Every
        // application therefore starts with an explicit anonymous principal.
        this._principal.clear();
    }
}
