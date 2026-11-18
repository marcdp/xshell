export default {
    meta: {
        title: "Home Launcher",
        description: "Launch Areas and pin Pages from their navigation menus."
    },
    dependencies: {
        home: "component:x-home"
    },
    template: `
        <p>The reusable <code>&lt;x-home&gt;</code> Component turns composed navigation menus into a launcher for your application.</p>
        <p>Pin a Page from Quick Links, then open the Home Launcher Area. Your favorite stays visible there and can take you back to the Cookbook.</p>
        <x-home></x-home>
    `
};
