import i18n from "../../../i18n.js";

class XTemplate {

    //fields
    _template = "";
    _styleSheets = null;
    _dependencies = null;
    _render = null;

    //ctor
    constructor({ template, styleSheets = [] }) { 
        this._compile({ template, styleSheets });
    }

    //props
    get template() {return this._template;}
    get styleSheets() {return this._styleSheets;}
    get dependencies() {return this._dependencies;}
    get render() {return this._render;}
    
    //methods
    _compile({ template, styleSheets = [] }) { 
        //create template from string if required
        if (typeof(template)=="string") {
            let templateElement = document.createElement("template");
            templateElement.innerHTML = template.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
            template = templateElement;
        }
        this._template = template;
        //create array of styleSheets if required
        if (styleSheets != null && !Array.isArray(styleSheets)) {
            styleSheets = [styleSheets];
        }
        for (let i=0; i < styleSheets.length; i++) {
            let styleSheet = styleSheets[i];
            if (styleSheet.sheet) {
                styleSheets[i] = styleSheet.sheet;
            } else if (typeof(styleSheet)=="string") {
                const newStyleSheet = new CSSStyleSheet();
                newStyleSheet.replaceSync(styleSheet);
                styleSheets[i] = newStyleSheet;
            }
        }
        this._styleSheets = styleSheets;
        //get dependencies
        this._dependencies = [...new Set(Array.from(template.content.querySelectorAll('*')).filter(el =>{ 
            if (el.tagName.includes('-')) {
                if (el.tagName == "X-LAZY" || el.closest("x-lazy") == null) {
                    return true;
                }
            }
            return false;
        }).map(el => el.tagName.toLowerCase()))];
        //compiles
        let code = [];
        code.push("let _ifs = {};");
        code.push("return [");
        let name = "x-something";
        let index = 0;
        template.content.childNodes.forEach((subNode) => {
            index += this._compileTemplateToJsRecursive(name, subNode, index, code, 0);
        });
        code.push("];");
        code = code.join("\n");
        this._render = new Function("state", "handler", "invalidate", "utils", "renderCount", code);
    }
    _compileTemplateToJsRecursive(name, node, index, js, level) {
        let indent = " ".repeat((level + 1) * 4);
        let incs = 0;
        if (node.nodeType == Node.TEXT_NODE) {
            //#text
            let textContent = node.textContent;
            let jsLine = [];
            jsLine.push(indent);
            jsLine.push("utils.createVDOM(\"#text\", null, null, null, {index: " + index + "}, " + JSON.stringify(textContent) + "),");
            js.push(jsLine.join(""));
            incs++;
        } else if (node.nodeType == Node.COMMENT_NODE) {
            //#comment
            let textContent = node.textContent;
            let jsLine = [];
            jsLine.push(indent);
            jsLine.push("utils.createVDOM(\"#comment\", null, null, null, {index: " + index + "}, " + JSON.stringify(textContent) + "),");
            js.push(jsLine.join(""));
            incs++;
        } else if (node.localName == "x:text") {
            //x:text
            let jsLine = [];
            jsLine.push(indent);
            jsLine.push("utils.createVDOM(\"#text\", null, null, null, {index: " + index + "}, \"\" + (" + node.textContent + ")),");
            js.push(jsLine.join(""));
            incs++;
        } else if (node.localName.startsWith("x:")) {
            //error
            console.error(`Error compiling component ${name}: invalid node ${node.localName}: not implemented`);
        } else {
            //element
            let jsLine = [];
            jsLine.push(indent);
            jsLine.push("utils.createVDOM(\"" + node.tagName.toLowerCase() + "\"");
            let jsPostLine = [];
            let jsPost = [];
            let attrs = [];
            let props = [];
            let events = [];
            let options = [];
            let text = "";
            options.push("index:" + index);
            for (let i = 0; i < node.attributes.length; i++) {
                let attr = node.attributes[i];
                if (attr.name == "x-text") {
                    //...<span x-text="state.value"></span>...
                    if (node.childNodes.length) console.error(`Error compiling component ${name}: invalid x-text node: non empty`);
                    text = "\"\" + " + attr.value;
                } else if (attr.name == "x-html") {
                    //...<span x-html="state.value"></span>...
                    if (node.childNodes.length) console.error(`Error compiling component ${name}: invalid x-html node: non empty`);
                    options.push("format:\"html\"");
                    text = "\"\" + " + attr.value;
                } else if (attr.name == "x-children") {
                    //...<span x-children="state.node"></span>...
                    options.push("format:\"node\"");
                    text = attr.value;
                } else if (attr.name == "x-attr" || attr.name == ":") {
                    //...<span x-attr="state.value"></span>...
                    //...<span :="state.value"></span>...
                    let attrValue = attr.value;
                    attrs.push("...utils.toObject(" + attrValue + ")");
                } else if (attr.name.startsWith("x-attr:") || attr.name.startsWith(":")) {
                    //...<span x-attr:title="state.value"></span>...
                    let attrName = (attr.name.startsWith(":") ? attr.name.substring(1) : attr.name.substr(attr.name.indexOf(':') + 1));
                    let attrValue = attr.value;
                    if (attrName.startsWith("[") && attrName.endsWith("]")) {
                        attrs.push("...utils.toDynamicArgument(" + attrName.substring(1, attrName.length - 1) + ", " + attrValue + ")");
                    } else {
                        attrs.push('"' + attrName + '":' + attrValue);
                    }
                } else if (attr.name == "x-prop" || attr.name == ".") {
                    //...<span x-prop="state.value"></span>...
                    //...<span .="state.value"></span>...
                    let propValue = attr.value;
                    attrs.push("..." + propValue + "");
                } else if (attr.name.startsWith("x-prop:") || attr.name.startsWith(".")) {
                    //...<input x-prop:value="state.value"></input>...
                    //...<input .value="state.value"></input>...
                    let propName = this._kebabToCamel((attr.name.startsWith(".") ? attr.name.substring(1) : attr.name.substr(attr.name.indexOf(':') + 1)));
                    let propValue = attr.value;
                    if (propName.startsWith("[") && propName.endsWith("]")) {
                        props.push("...utils.toDynamicProperty(" + propName.substring(1, propName.length - 1) + ", " + propValue + ")");
                    } else {
                        props.push(propName + ":" + propValue);
                    }
                } else if (attr.name.startsWith("x-on:") || attr.name.startsWith("@")) {
                    //...<button x-on:click="onIncrement">+1</button>...
                    //...<button @click="onIncrement">+1</button>...
                    let eventName = (attr.name.startsWith("@") ? attr.name.substring(1) : attr.name.substr(attr.name.indexOf(':') + 1));
                    let eventHandler = attr.value;
                    events.push("'" + eventName + "': (event) => handler('" + eventHandler + "', event)");
                } else if (attr.name == "x-if") {
                    //...<span x-if="state.value > 0">greather than 0</span>...
                    jsLine[0] = indent + "...((_ifs.c" + level + " = (" + attr.value + ")) ? [";
                    //jsPostLine.push("] : []),");
                    jsPostLine.push("] : [utils.createVDOM(\"#comment\", null, null, null, {index: " + index + "}, 'x-if')]),");
                } else if (attr.name == "x-elseif") {
                    //...<span x-elseif="state.value < 0">less than 0</span>...
                    jsLine[0] = indent + "...(_ifs.c" + level + " ? [] : (_ifs.c" + level + " = (" + attr.value + ")) ? [";
                    //jsPostLine.push("] : []),");
                    jsPostLine.push("] : [utils.createVDOM(\"#comment\", null, null, null, {index: " + index + "}, 'x-elseif')]),");
                } else if (attr.name == "x-else") {
                    //...<span x-else>is 0</span>...
                    jsLine[0] = indent + "...(!_ifs.c" + level + " ? [";
                    //jsPostLine.push("] : []),");
                    jsPostLine.push("] : [utils.createVDOM(\"#comment\", null, null, null, {index: " + index + "}, 'x-else')]),");
                } else if (attr.name == "x-for") {
                    //...<li x-for="item in state.items" x-key="name">{{item.name + '(' + item.count + ') '}}</li>...
                    let keyName = node.getAttribute("x-key");
                    let forType = "";
                    if (keyName) {
                        forType = "key";
                    } else {
                        forType = "position";
                    }
                    //creates a comment virtual node that indicates the start of the for loop, and the type of the loop
                    js.push(indent + "utils.createVDOM(\"#comment\", null, null, null, {index: " + index + ", forType:'" + forType + "'}, 'x-for-start'),");
                    //add loop
                    let parts = attr.value.split(" in ");
                    if (parts.length != 2) console.error(`Error compiling template: invalid x-for attribute detected: ${attr.value}`);
                    let itemName = parts[0].trim();
                    let indexName = "index";
                    if (itemName.startsWith("(") && itemName.endsWith(")")) {
                        let arr = itemName.substring(1, itemName.length - 1).split(",");
                        itemName = arr[0].trim();
                        indexName = arr[1].trim();
                    }
                    let listName = parts[1].trim();
                    jsLine[0] = indent + "...(utils.toArray(" + listName + ").map((" + itemName + ", " + indexName + ") => ";
                    jsPostLine.push(")),");
                    options.push("\"key\":" + itemName + "." + keyName);
                    //creates a comment end node that indicates the end of the for loop
                    jsPost.push(indent + "utils.createVDOM(\"#comment\", null, null, null, {index: " + index + ", forType:'" + forType + "'}, 'x-for-end'),");
                } else if (attr.name == "x-key") {
                    //used in x-for
                } else if (attr.name == "x-show") {
                    //...<span x-show="state.value > 0">greather than 0</span>...
                    attrs.push("...(" + (attr.value) + " ? null : {style:'display:none'})");
                } else if (attr.name == "x-model") {
                    //...<input type="text" x-model="state.name"/>... --> <input type="text" x-prop:value="state.name" x-on:change.stop="state.name = event.target.value"/>
                    //prop
                    let nodeName = node.tagName.toLowerCase();
                    let propertyName = "value";
                    let propValue = attr.value;
                    if (nodeName == "input") {
                        let type = node.getAttribute("type");
                        if (type == "range") {
                            propertyName = "valueAsNumber";
                        } else if (type == "checkbox") {
                            propertyName = "checked";
                        } else if (type == "radio") {
                            propertyName = "checked";
                            propValue = "function() { return state.value == this.attrs.value}";
                        }
                    } else if (nodeName == "select") {
                        let multiple = node.getAttribute("multiple");
                        if (multiple) {
                            propertyName = "selectedOptions";
                            propValue = "Array.from(event.target.selectedOptions).map(option => option.value)";
                        }
                    } else if (nodeName == "textarea") {
                    }
                    props.push(propertyName + ":" + propValue);
                    //event
                    events.push(`'change.stop': (event) => { 
                        ${attr.value} = utils.getInputValue(event.target);
                        invalidate(); 
                    }`);

                } else if (attr.name == "x-once") {
                    //x-once: only render once
                    jsLine[0] = indent + "...((renderCount==0) ? [";
                    jsPostLine.push("] : [utils.createVDOM('" + node.tagName.toLowerCase() + "', null, null, null, {once:true})]),");
                } else if (attr.name == "x-pre") {
                    //v-pre: skip childs
                    options.push("format:\"html\"");
                    text = JSON.stringify(node.innerHTML).replaceAll("<x:text>", "{{").replaceAll("</x:text>", "}}");
                } else if (attr.name.startsWith("x-")) {
                    //error
                    console.error(`Error compiling template: invalid template attribute detected: ${attr.name}`);
                } else {
                    attrs.push("'" + attr.name + "':" + JSON.stringify(attr.value));
                }
            }
            jsLine.push(", " + (attrs.length ? '{' + attrs.join(',') + '}' : "null"));
            jsLine.push(", " + (props.length ? '{' + props.join(',') + '}' : "null"));
            jsLine.push(", " + (events.length ? '{' + events.join(',') + '}' : "null"));
            jsLine.push(", " + (options.length ? '{' + options.join(',') + '}' : "null"));
            if (text) {
                jsLine.push(", " + text + "");
                jsLine.push(")," + (jsPostLine.length ? jsPostLine.join('') : ''));
                js.push(jsLine.join(''));
            } else if (node.childNodes.length > 0) {
                jsLine.push(", [");
                js.push(jsLine.join(''));
                node.childNodes.forEach((subNode, subIndex) => {
                    this._compileTemplateToJsRecursive(name, subNode, subIndex, js, level + 1);
                });
                js.push(indent + "])," + (jsPostLine.length ? jsPostLine.join('') : ''));
            } else {
                jsLine.push(")," + (jsPostLine.length ? jsPostLine.join('') : ''));
                js.push(jsLine.join(''));
            }
            if (jsPost.length) js.push(jsPost.join(''));
            incs++;
        }
        return incs;
    }
    _kebabToCamel(str) {
        return str.split('-')
            .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    //public methods
    createInstance(state, handler, invalidate, element) {
        return new XTemplateInstance(this, state, handler, invalidate, element);
    }

}
 

// utils
const emptyObject = {};
const emptyArray = [];
let freeId = 1;
const utils = new class {
    createVDOM = (tag, attrs, props, events, options, children) => {
        return {
            tag: tag,
            attrs: attrs ?? emptyObject,
            props: props ?? emptyObject,
            events: events ?? emptyObject,
            options: options ?? { index: 0 },
            children: children ?? emptyArray
        };
    };
    toArray = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof (value) == "number") return Array.from({ length: value }, (v, i) => i + 1);
        if (typeof (value) == "string") return [...value];
        if (typeof (value) == "object") return Object.keys(value);
        return value;
    };
    toObject = (value) => {
        let result = {};
        for (let key in value) {
            let val = value[key];
            if (typeof (val) == "string") {
                result[key] = val;
            } else if (typeof (val) == "number") {
                result[key] = val;
            } else if (typeof (val) == "boolean") {
                if (val) result[key] = true;
            }
        }
        return result;
    };
    toDynamicArgument = (key, value) => {
        return { [key]: value };
    };
    toDynamicProperty = (key, value) => {
        return { [key]: value };
    };
    i18n(value, lang) {
        if (!value) return "";
        var key = "i18n:" + lang + "=";
        if (value.startsWith(key)) {
            let j = value.indexOf("|");
            return value.substring(key.length, j != -1 ? j : value.length).replaceAll("&#124;","|");
        } else {
            let k = value.indexOf("|" + key);
            if (k != -1) {
                let j = value.indexOf("|", k + 1);
                return value.substring(k + key.length + 1, j != -1 ? j : value.length).replaceAll("&#124;","|");
            }
        }
        return "";
    }
    getLang(lang) {
        return i18n.getLang(lang) ?? { id: lang, label: lang };
    }
    getFreeId() {
        return "id" + freeId++;
    };
    getInputValue(target) {
        let value = target.value;
        if (target.localName == "input") {
            if (target.type == "number") {
                value = target.valueAsNumber; 
            } else if (target.type == "range") {
                value = target.valueAsNumber; 
            } else if (target.type == "checkbox") {
                value = target.checked; 
            } else if (target.type == "radio") {
                value = target.value; 
            }
        } else if (target.localName == "select") {
            value = Array.from(target.selectedOptions).map(option => option.value).join(',')
        }
        return value;
    }
};


// class
class XTemplateInstance {

    //fields
    _xtemplate = null;
    _state = null;
    _element = null;
    _handler = null;
    _invalidate = null;

    //work fields
    _renderCount = 0;
    _vdom = null;

    //ctor
    constructor(xtemplate, state, handler, invalidate, element) {
        this._xtemplate = xtemplate;
        this._state = state;
        this._element = element;
        this._element.adoptedStyleSheets = xtemplate.styleSheets;
        this._handler = handler;
        this._invalidate = invalidate;
    }

    //props
    get state() {return this._state;}

    // methods
    render() {
        //render vdom
        let vdom = this._xtemplate.render(this._state, this._handler, this._invalidate, utils, this._renderCount++);
        //render vdom to dom
        if (this._vdom == null) {
            let index = 0;
            for (let vNode of vdom) {
                while (index < vNode.options.index) {
                    let comment = document.createComment("");
                    this._element.appendChild(comment);
                    index++;
                }
                let element = this._createDomElement(vNode);
                this._element.appendChild(element);
                index++;
            }
            this._vdom = vdom;
        } else {
            this._diffDom(this._vdom, vdom, this._element, 0);
            this._vdom = vdom;
        }
    }
    _createDomElement(vNode) {
        //create element from vdom node
        if (vNode.tag == "#text") {
            return document.createTextNode(vNode.children);
        } else if (vNode.tag == "#comment") {
            return document.createComment(vNode.children);
        } else {
            let el = document.createElement(vNode.tag);
            for (let attr in vNode.attrs) {
                let attrValue = vNode.attrs[attr];
                if (attrValue == null) {
                } else if (typeof (attrValue) == "boolean") {
                    if (attrValue) {
                        el.setAttribute(attr, "");
                    }
                } else {
                    el.setAttribute(attr, attrValue);
                }
            }
            for (let prop in vNode.props) {
                let propValue = vNode.props[prop];
                if (typeof(propValue) == "function") {
                    propValue = propValue.call(vNode);
                }
                //if (!el.hasOwnProperty(prop)) {
                if (el[prop] === undefined) {
                    //the property does not exist in the element yet
                    if (!el._propertiesToInitialize) el._propertiesToInitialize = [];
                    el._propertiesToInitialize.push({name: prop, value: propValue});
                } else {
                    el[prop] = propValue;
                }
            }
            for (let event in vNode.events) {
                let eventHandler = vNode.events[event];
                let name = event;
                let options = {};
                if (name.indexOf(".") != -1) {
                    let modifiers = name.split(".").slice(1);
                    for (let modifier of modifiers) { //https://v2.vuejs.org/v2/guide/events
                        options[modifier] = true;
                    }
                    name = name.substring(0, name.indexOf("."));
                }
                if (typeof (eventHandler) == "string") eventHandler = new Function("event", eventHandler);                
                el.addEventListener(name, (event, ...args) => {
                    //mouse button
                    if (options.left && !event.button == 0) return false;
                    if (options.middle && !event.button == 1) return false;
                    if (options.right && !event.button == 2) return false;
                    //keys
                    if (options.alt && !event.altlKey) return false;
                    if (options.shift && !event.shiftKey) return false;
                    if (options.ctrl && !event.ctrlKey) return false;
                    if (name == "keydown" || name == "keypress" || name == "keyup") {
                        if (options.escape && event.key != "Escape") return false;
                        if (options.enter && event.key != "Enter") return false;
                        if (options.tab && event.key != "Tab") return false;
                        if (options.backspace && event.key != "Backspace") return false;
                        if (options.delete && event.key != "Delete") return false;
                        if (options.space && event.key != " ") return false;
                        if (options.up && event.key != "ArrowUp") return false;
                        if (options.down && event.key != "ArrowDown") return false;
                        if (options.left && event.key != "ArrowLeft") return false;
                        if (options.right && event.key != "ArrowRight") return false;
                    }
                    //invoke
                    let result = eventHandler.call(this, event, ...args);
                    //stop, prevent
                    if (options.stop) event.stopPropagation();
                    if (options.prevent) event.preventDefault();
                    //return
                    return result;
                }, options);
            }
            if (vNode.options.format == 'node') {
                if (Array.isArray(vNode.children)) {
                    el.replaceChildren();
                    for(let element of vNode.children) {
                        el.appendChild(element);
                    }
                } else if (vNode.children) {
                    if (el.firstChild != vNode.children) {
                        if (el.firstChild) el.replaceChildren();
                        el.appendChild(vNode.children);
                    }
                } else {
                    el.replaceChildren();
                }
            } else if (Array.isArray(vNode.children)) {
                let index = 0;
                for (let child of vNode.children) {
                    while (index < child.options.index) {
                        let comment = document.createComment("");
                        el.appendChild(comment);
                        index++;
                    }
                    let childElement = this._createDomElement(child);
                    el.appendChild(childElement);
                    index++;
                }
            } else if (typeof (vNode.children) == "string") {
                if (vNode.options.format == 'html') {
                    el.innerHTML = vNode.children;
                } else {
                    el.textContent = vNode.children;
                }
            }
            //if (config.debug) el.setAttribute("x-index", vNode.options.index);
            return el;
        }
    }
    _diffDom(vNodesOld, vNodesNew, parent, level) {
        //apply differences between two arrays of vdom elements
        let iold = 0;
        let inew = 0;
        for (let i = 0; ; i++) {
            let vNodeOld = vNodesOld[i + iold] ?? null;
            let vNodeNew = vNodesNew[i + inew] ?? null;
            if (vNodeOld == null && vNodeNew == null) {
                //nothing to do
                break;
            } else if (vNodeOld == null) {
                //append
                let element = this._createDomElement(vNodeNew);
                parent.appendChild(element);
            } else if (vNodeNew == null) {
                //remove
                parent.removeChild(parent.lastChild);
            } else if (vNodeOld.options.index < vNodeNew.options.index) {
                //remove old node
                let comment = document.createComment("");
                parent.replaceChild(comment, parent.childNodes[vNodeOld.options.index + inew]);
                inew--;
            } else if (vNodeOld.options.index > vNodeNew.options.index) {
                //replace node
                let element = this._createDomElement(vNodeNew);
                parent.replaceChild(element, parent.childNodes[vNodeNew.options.index + inew]);
                iold--;
            } else if (vNodeOld.tag == "#comment" && vNodeOld.options.forType == "key" && vNodeNew.tag == "#comment" && vNodeNew.options.forType == "key") {
                //for loop by key
                let oldStartIndex = i + iold;
                let oldEndIndex = oldStartIndex;
                while (vNodesOld[oldEndIndex].children != 'x-for-end') oldEndIndex++;
                let newStartIndex = i + inew;
                let newEndIndex = newStartIndex;
                while (vNodesNew[newEndIndex].children != 'x-for-end') newEndIndex++;
                this._diffDomListByKey(vNodesOld, oldStartIndex, oldEndIndex, vNodesNew, newStartIndex, newEndIndex, parent, level + 1);
                iold += oldEndIndex - oldStartIndex;
                inew += newEndIndex - newStartIndex;
            } else if (vNodeOld.tag == "#comment" && vNodeOld.options.forType == "position" && vNodeNew.tag == "#comment" && vNodeNew.options.forType == "position") {
                //for loop by position
                let oldStartIndex = i + iold;
                let oldEndIndex = oldStartIndex;
                while (vNodesOld[oldEndIndex].children != 'x-for-end') oldEndIndex++;
                let newStartIndex = i + inew;
                let newEndIndex = newStartIndex;
                while (vNodesNew[newEndIndex].children != 'x-for-end') newEndIndex++;
                this._diffDomListByPosition(vNodesOld, oldStartIndex, oldEndIndex, vNodesNew, newStartIndex, newEndIndex, parent, -999, level + 1);
                iold += oldEndIndex - oldStartIndex;
                inew += newEndIndex - newStartIndex;
            } else if (vNodeOld.tag != vNodeNew.tag) {
                //replace node
                let element = this._createDomElement(vNodeNew);
                parent.replaceChild(element, parent.childNodes[vNodeNew.options.index + inew]);
            } else if (vNodeOld.tag == "slot" && vNodeNew.tag == "slot") {
                //slot
            } else {
                //diff node
                //if (!parent) debugger
                let child = parent.childNodes[vNodeNew.options.index + inew];
                this._diffDomElement(vNodeOld, vNodeNew, child, level + 1);
            }
        }
    }
    _diffDomElement(vNodeOld, vNodeNew, element, level) {
        if (vNodeNew.options.once) {
            return;
        }
        //attrs
        let validAttrs = [];
        for (let attr in vNodeNew.attrs) {
            let attrValue = vNodeNew.attrs[attr];
            if (attrValue != vNodeOld.attrs[attr]) {
                if (typeof (attrValue) == "boolean") {
                    if (attrValue) {
                        element.setAttribute(attr, "");
                    } else {
                        element.removeAttribute(attr);
                    }
                } else if (attrValue == null) {
                    element.removeAttribute(attr);
                } else {
                    element.setAttribute(attr, attrValue);
                }
            }
            validAttrs.push(attr);
        }
        for (let attr in vNodeOld.attrs) {
            if (validAttrs.indexOf(attr) == -1) {
                element.removeAttribute(attr);
            }
        }
        //props  
        let validProps = [];
        for (let prop in vNodeNew.props) {
            let propValue = vNodeNew.props[prop];
            if (typeof(propValue)=="function") {
                propValue = propValue.call(vNodeNew);
            }
            if (propValue != vNodeOld.props[prop]) {
                element[prop] = propValue;
            }
            validProps.push(prop);
        }
        //children
        if (vNodeNew.options.format == 'node') {
            if (Array.isArray(vNodeNew.children)) {
                element.replaceChildren();
                for(let childElement of vNodeNew.children) {
                    element.appendChild(childElement);
                }
            } else if (vNodeNew.children) {
                if (element.firstChild != vNodeNew.children) {
                    if (element.firstChild) element.replaceChildren();
                    element.appendChild(vNodeNew.children);
                }
            } else {
                element.replaceChildren();
            }
        } else if (Array.isArray(vNodeNew.children)) {
            this._diffDom(vNodeOld.children, vNodeNew.children, element, level + 1);
        } else if (typeof (vNodeNew.children) == "string") {
            if (vNodeOld.children != vNodeNew.children) {
                if (vNodeNew.options.format == 'html') {
                    element.innerHTML = vNodeNew.children;
                } else if (vNodeNew.options.format == 'json') {
                    element.textContent = JSON.stringify(vNodeNew.children);
                } else {
                    element.textContent = vNodeNew.children;
                }
            }
        }
    }
    _diffDomListByPosition(vNodesOld, oldStartIndex, oldEndIndex, vNodesNew, newStartIndex, newEndIndex, parent, parentBaseIndex, level) {
        //diff by position
        let oldLength = oldEndIndex - 1 - oldStartIndex;
        let newLength = newEndIndex - 1 - newStartIndex;
        let parentChildrenDesp = 0;
        for (let i = 0; i < newLength; i++) {
            let vNodeOld = vNodesOld[oldStartIndex + 1 + i];
            if (oldStartIndex + 1 + i >= oldEndIndex) vNodeOld = null;
            let vNodeNew = vNodesNew[newStartIndex + 1 + i];
            if (vNodeOld == null) {
                let element = this._createDomElement(vNodeNew);
                parent.insertBefore(element, parent.childNodes[newStartIndex + 1 + i + parentChildrenDesp]);
            } else {
                let element = parent.childNodes[newStartIndex + 1 + i + parentChildrenDesp];
                this._diffDomElement(vNodeOld, vNodeNew, element, level + 1);
            }        
        }
        while (newLength < oldLength) {
            let element = parent.childNodes[newStartIndex + 1 + newLength + parentChildrenDesp];
            parent.removeChild(element);
            oldLength--;
        }        
    }
    _diffDomListByKey(vNodesOld, oldStartIndex, oldEndIndex, vNodesNew, newStartIndex, newEndIndex, parent, level) {
        //get oldKeys and newKeys
        let oldKeys = [];
        for (let i = oldStartIndex + 1; i < oldEndIndex; i++) {
            oldKeys.push(vNodesOld[i].options.key);
        }
        let newKeys = [];
        for (let i = newStartIndex + 1; i < newEndIndex; i++) {
            newKeys.push(vNodesNew[i].options.key);
        }       
        //check for duplicates
        const duplicates = newKeys.filter((item, index) => newKeys.indexOf(item) !== index);
        if (duplicates.length) {
            console.warn(`Duplicated keys detected in x-for loop: ${duplicates}`);
        }
        //remove old keys, and old DOM elements
        let removeKeys = [];
        for (let i = oldKeys.length - 1; i >= 0; i--) {
            let key = oldKeys[i];
            if (newKeys.indexOf(key) == -1) {
                parent.removeChild(parent.childNodes[newStartIndex + i + 1]);
                removeKeys.push(key);
                oldKeys.splice(i, 1);
            }
        }
        //add new keys, and new DOM elements
        let addedKeys = [];
        for (let i = 0; i < newKeys.length; i++) {
            let key = newKeys[i];
            if (oldKeys.indexOf(key) == -1) {
                let element = this._createDomElement(vNodesNew[newStartIndex + i + 1]);
                parent.insertBefore(element, parent.childNodes[newStartIndex + i + 1]);
                oldKeys.splice(i, 0, key);
                addedKeys.push(key);
            }
        }
        //reorder keys and DOM elements
        for (let i = 0; i < newKeys.length; i++) {
            let key = newKeys[i];
            let newIndex = i;
            let oldIndex = oldKeys.indexOf(key);
            if (newIndex != oldIndex) {
                parent.insertBefore(parent.childNodes[oldStartIndex + oldIndex + 1], parent.childNodes[oldStartIndex + newIndex + 1]);
                oldKeys.splice(oldIndex, 1);
                oldKeys.splice(newIndex, 0, key);
                let old = vNodesOld.splice(oldStartIndex + 1 + oldIndex, 1);
                vNodesOld.splice(oldStartIndex + 1 + newIndex, 0, old[0]);
            }
        }
        //for each element in list, apply the differences
        for (let i = 0; i < newKeys.length; i++) {
            let key = newKeys[i];
            if (addedKeys.indexOf(key) == -1) {
                let vNodeOld = vNodesOld[oldStartIndex + 1 + i];
                let vNodeNew = vNodesNew[newStartIndex + 1 + i];
                let element = parent.childNodes[newStartIndex + 1 + i];
                this._diffDomElement(vNodeOld, vNodeNew, element, level);
            }
        }
    }

}

// export
export default XTemplate;

export {utils};
