import XElement from "x-element";

//utils
function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// export
export default XElement.define("x-json", {
    style:`
        :host {}
        pre {
            margin: 0;
            padding: 0;
            white-space: wrap;
            word-break: break-all;
        }
        .string {
            color: green;
        }
        .number {
            color: darkorange;
        }
        .boolean {
            color: blue;
        }
        .null {
            color: magenta;
        }
        .key {
            color: red;
        }
        :host(.plain) pre {
            border: none;
            padding: 0;
        }
    `,
    template: `
        <pre><code x-html="state.colorized"></code></pre>
    `,
    state: {
        value:"",
        colorized:""
    },
    methods: {
        onCommand(command) {
            if (command == "init"){
                //init
                this.bindEvent(this.state, "change:value", (event) => {
                    this.state.colorized = syntaxHighlight(event.newValue);
                });
            }
        }
    }                
});
