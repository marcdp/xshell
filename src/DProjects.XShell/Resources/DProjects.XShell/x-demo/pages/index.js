// contract
export const contract = {
    description: "Index page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    style: `
        P {display:block; border:1px red dotted}
    `,
    template: `
        <p>
            this is the index page
        </p>
    `,    
    controller({ state, loader }) {
        return {
            async load(params) {
               // load
               //var aux = await loader.load("dataset:static:a=1|b=2|c=3");
               var countries = await loader.load("dataset:x-demo:countries");
            }
        };
    }
}
