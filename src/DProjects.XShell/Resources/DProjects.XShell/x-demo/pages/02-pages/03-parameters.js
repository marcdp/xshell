
export const contract = {
    properties: {
        name: {type:"string", default:"Ada", query:true, state:true},
        count: {type:"number", default:1, query:true, state:true, reflect:true}
    }
};

export default {
    meta: {
        title: "Page Parameters",
        description: "Demonstrates public Page properties, query parameters, defaults, and route parameters."
    },

    template: `
        <p>Pages can expose public properties through a <code>contract</code>. These properties can receive values from the URL and are available through Page state.</p>

        <h2>Public properties</h2>
        <p>The <code>contract</code> declares each property's type, default value, and behavior. Unlike private Page state, public properties form part of the Page's external interface.</p>
        <pre x-pre><code>export const contract = {
    properties: {
        name: {type:"string", default:"Ada", query:true, state:true},
        count: {type:"number", default:1, query:true, state:true, reflect:true}
    }
};</code></pre>

        <h2>Current values</h2>
        <p>These values come from the Page's public properties. When no values are supplied, the contract defaults are used.</p>
        <x-datafields columns="2">
            <x-datafield label="Name">{{ state.name }}</x-datafield>
            <x-datafield label="Count">{{ state.count }}</x-datafield>
        </x-datafields>
        <p>
            <x-button label="Increment" command="increment"></x-button>
            <x-button label="Reset count" command="resetCount"></x-button>
        </p>
        <pre x-pre><code>&lt;p&gt;Name: {{ state.name }}&lt;/p&gt;
&lt;p&gt;Count: {{ state.count }}&lt;/p&gt;</code></pre>

        <h2>Query parameters</h2>
        <p>Setting <code>query:true</code> allows a public property to receive its value from the URL query string. The declared type determines how the value is interpreted.</p>
        <p><x-anchor href="03-parameters.js?name=Grace&amp;count=7">Open with name=Grace and count=7</x-anchor></p>
        <p><x-anchor href="03-parameters.js?name=Linus&amp;count=3">Open with name=Linus and count=3</x-anchor></p>
        <p><x-anchor href="03-parameters.js">Open with default values</x-anchor></p>
        <pre x-pre><code>03-parameters.js?name=Grace&amp;count=7

name  → "Grace" (string)
count → 7       (number)</code></pre>

        <h2>Property options</h2>
        <p>The contract uses several options to control how public properties behave.</p>
        <x-datafields columns="2">
            <x-datafield label="type">Declares the property's value type.</x-datafield>
            <x-datafield label="default">Provides an initial value when none is supplied.</x-datafield>
            <x-datafield label="query">Allows the property to be initialized from URL query parameters.</x-datafield>
            <x-datafield label="state">Exposes the property through reactive Page state.</x-datafield>
            <x-datafield label="reflect">Reflects property changes to its corresponding attribute.</x-datafield>
        </x-datafields>
        <p>Incrementing the count changes its reactive value and demonstrates the <code>reflect</code> option. Reflection is separate from updating the browser URL.</p>

        <h2>Route parameters</h2>
        <p>Routes map friendly URLs to Page resources. The cookbook defines a route that sends a name parameter to this Page.</p>
        <pre x-pre><code>"routes": {
    "/hello/{name}": "/pages/02-pages/03-parameters.js"
}</code></pre>
        <p><x-anchor href="/cookbook/hello/Grace">Open /cookbook/hello/Grace</x-anchor></p>
        <p><x-anchor href="/cookbook/hello/Ada">Open /cookbook/hello/Ada</x-anchor></p>
        <p>The route parameter <code>{name}</code> supplies the public <code>name</code> property. Other properties continue to use their defaults unless values are provided.</p>

        <h2>Reactive updates</h2>
        <p>Controller commands can modify public properties through the reactive state interface, just as they modify private state.</p>
        <pre x-pre><code>controller({state}) {
    return {
        increment() {state.count++;},
        resetCount() {state.count=1;}
    };
}</code></pre>
    `,

    controller({state}) {
        return {
            increment() {state.count++;},
            resetCount() {state.count=1;}
        };
    }
};
