export default {
    contract: {
        tags: ["home", "navigation"],
        properties: {
            areaId: {type: "string", default: "", query: true, state: true, description: "Area whose navigation menu supplies Quick Links."}
        }
    },
    meta: {
        title: "Home"
    },
    dependencies: {
        home: "component:x-home"
    },
    template: `<x-home x-attr:area-id="state.areaId"></x-home>`
};
