import XElement from "./x-element.js";

export default async function(input, src) {
    let html = await input.text();
    return XElement.defineFromHTML(html, src);
}



