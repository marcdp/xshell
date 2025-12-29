export default {
    async resolve() {
        // always return anonymous identity
        return {
            status: "authenticated",
            identity: Object.freeze({
                id: "anonymous", 
                name: "Anonymous",
                roles: [],
                claims: {}
            })
        };
    },
    logout() {
        // reload document
        location.reload();
    }
};