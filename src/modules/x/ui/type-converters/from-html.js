import XElement from "../x-element.js";
import utils from "../../../../utils.js";

//function that converts a fetch response to an XElement (parse html, extract template, style, script, and define an XElement)
export default async function(response, src) {
    let html = await response.text();
    let name = src.substring(src.lastIndexOf("/")+1).split(".")[0];
    let baseUrl = src.substring(0, src.lastIndexOf("/"));
    //preprocess
    html = html.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
    //parse
    let domParser = new DOMParser();
    let doc = domParser.parseFromString(html, "text/html");
    //styleSheets
    let styleSheets = [];
    doc.head.querySelectorAll("head > style, body > style").forEach((style) => {
        var styleSheet = new CSSStyleSheet({baseUrl});
        styleSheet.replaceSync(style.textContent);
        styleSheets.push(styleSheet);
    });
    //template
    let template = doc.head.querySelector(":scope > template");
    if (!template) template = doc.body.querySelector(":scope > template");
    //script
    let script = doc.head.querySelector(":scope > script");
    if (!script) script = doc.body.querySelector(":scope > script");
    //load script module
    let module = await utils.importModuleFromJSCode(script.textContent, src);
    //definition
    let definition = module.default;
    definition.template = template;
    definition.style = styleSheets;
    //return 
    return XElement.define(name, definition);
}



