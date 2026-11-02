
export default {
    contract: {
        description: "Filesystem file editor",
        events: {},
        properties: {
            src: {type:"string", default:null, state:true, query:true},
            path: {type:"string", default:null, state:true, query:true}
        },
        methods: {}
    },

    meta: {
        title:"Edit file"
    },

    style: `
        :scope x-template { height:100%; display:flex;}
        :scope x-template > * {flex:1;}
    `,

    template: `
        <x-fill>
        <x-template 
            x-prop:template="state.template" 
            x-model="state.value"
            >
        </x-template>
        </x-fill>
    `,

    state: {
        filesystem:null,
        src:null,
        path:null,
        entry: null,
        value: null,
        template: null
    },

    controller({state, page, loader, resolver, events}) {
        return {
            async load() {
                // load
                this.refresh();
            },
            async refresh() {
                // refresh
                state.filesystem = await loader.load("filesystem:" + state.src);
                state.entry = await state.filesystem.getEntry(state.path);
                // resolve editor for the file extension
                const extension = state.entry ? state.entry.name.split('.').pop() : null;
                let editorResolverDefinition = resolver.resolve("editor:" + extension);
                if (!editorResolverDefinition) editorResolverDefinition = resolver.resolve("editor:default");
                // load editor web component
                let componentName = editorResolverDefinition.path;
                await loader.load("component:" + componentName);
                state.template = `<${componentName} x-model="state.value"></${componentName}>`;
                // load value
                const stream = await state.filesystem.loadReadStream(state.path);
                const text = await new Response(stream).text();
                state.value = {
                    value:text
                };
            }
        };
    }
};
