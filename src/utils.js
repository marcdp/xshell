// funcs
/*
function deepAssign(obj1, obj2) {
    for (let key in obj2) {
        if (Object.prototype.hasOwnProperty.call(obj2, key)) {
            if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
                for (let item of obj2[key]) {
                    if (typeof (item) == "object" && item.id) {
                        let aux = obj1[key].filter(x => x.id == item.id)
                        if (aux.length) {
                            deepAssign(aux[0], item);
                        } else {
                            obj1[key].push(item);
                        }
                    } else {
                        if (obj1[key].indexOf(item) == -1) {
                            obj1[key].push(item);
                        }
                    }
                }
            } else if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
                obj1[key] = deepAssign(obj1[key], obj2[key]);
            } else {
                obj1[key] = obj2[key];
            }
        }
    }
    return obj1;
}
*/

// class
class Utils {

    /*
    static deepAssign(target, ...sources) {
        return deepAssign(target, ...sources);
    }
    static traverse(obj, callback) {
        for (let key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (Array.isArray(obj[key])) {
                    callback(obj, key);
                    for (let item of obj[key]) {
                        this.traverse(item, callback);
                    }
                } else if (obj[key] instanceof Object) {
                    this.traverse(obj[key], callback);
                } else {
                    callback(obj, key);
                }
            }
        }
    }*/
    static absolutizeUrl(url) {
        if (url.startsWith("/")) url = window.location.origin + url;
        return url;
    }
    static combineUrls(a, b) {
        if (b.indexOf(":") != -1) return b;
        if (b.startsWith("/")) {
            if (a.indexOf("://") != -1) {
                let i = a.indexOf("/", a.indexOf("://") + 3);
                if (i != -1) a = a.substring(0, i);
                return a + b;
            }
            return b;
        } else if (b.startsWith("./") || b==".") {
            if (a.endsWith("/")) {
                a = a.substring(0, a.length - 1);
            } else if (a.length > 0) {
                a = a.substring(0, a.lastIndexOf("/"));
            }
            return a + b.substring(1);
        } else if (b.startsWith("../")) {
            if (a.endsWith("/")) {
                a = a.substring(0, a.length - 1);
            } else if (a.length > 0) {
                a = a.substring(0, a.lastIndexOf("/"));
            }
            let result = a + "/" + b;
            if (result.startsWith("/")) {
                const normalizedUrl = new URL(result, window.location.origin);
                result = normalizedUrl.pathname;
            } else {
                result = (new URL(result)).toString();
            }
            return result;
        } else {
            if (a.endsWith("/")) { 
                //empty
            } else if (a.indexOf("/") != -1) {
                a = a.substring(0, a.lastIndexOf("/") + 1);
            }
            return a + b;
        }
      }
    static async importModuleFromJSCode(js, url) {
        if (url && url.indexOf("?") != -1) url = url.substring(0, url.indexOf("?"));
        //const baseUrl = Utils.absolutizeUrl(url.substring(0, url.lastIndexOf("/")));
        const baseUrl = Utils.absolutizeUrl(url);
        //replace each import relative URL with an absolute URL
        if (js.indexOf("import ") != -1) {
            const importRegex = /(import\s+.*?['"])(\.\/|\.\.\/|\/)([^'"]+)(['"])/g;
            js = js.replace(importRegex, (match, start, pathType, urlPath, end) => {
                const absoluteUrl = Utils.combineUrls(baseUrl, pathType + urlPath);
                return `${start}${absoluteUrl}${end}`;
            });
        }
        //import module from blobc
        const blob = new Blob([js], { type: "application/javascript" });
        const moduleURL = URL.createObjectURL(blob);
        const module = await import(moduleURL);
        URL.revokeObjectURL(moduleURL);
        //return
        return module;
    }
    /*
    static stripJsonComments(jsonString){
        let result = '';
        let insideString = false;
        let skipNextChar = false;
        let i = 0;

        while (i < jsonString.length) {
            const char = jsonString[i];
            const nextChar = jsonString[i + 1];

            // Toggle the `insideString` flag when encountering a double-quote not escaped
            if (char === '"' && !skipNextChar) {
                insideString = !insideString;
            }

            // If not inside a string, check for comments
            if (!insideString) {
                // Check for single-line comment
                if (char === '/' && nextChar === '/') {
                    // Skip until the end of the line
                    i += 2;
                    while (i < jsonString.length && jsonString[i] !== '\n') {
                        i++;
                    }
                    continue;
                }

                // Check for multi-line comment
                if (char === '/' && nextChar === '*') {
                    // Skip until the end of the comment
                    i += 2;
                    while (i < jsonString.length && !(jsonString[i] === '*' && jsonString[i + 1] === '/')) {
                        i++;
                    }
                    i += 2;
                    continue;
                }
            }

            // Append current character to result
            result += char;

            // Check if this character is an escape character
            skipNextChar = char === '\\' && !skipNextChar;

            // Move to the next character
            i++;
        }

        return result.trim();
    }*/

};


//export
export default Utils;