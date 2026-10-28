
export default {
    meta: {
        title: "Modules",
        description: "Learn how XShell Modules organize configuration, resources, controllers, and navigation."
    },

    template: `
        <p>A Module defines configuration and groups resources such as Pages, Components, icons, and DataSets. It may also provide a controller for Module-wide behavior.</p>
        <p>Start with the local definition and external references, then inspect resources and the controller. Finish with menu contributions, Areas, and declarative resource dependencies.</p>
        <x-page-index></x-page-index>        
    `
};
