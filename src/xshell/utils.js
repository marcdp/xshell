
// class
class Utils {

    static absolutizeUrl(url) {
        if (url.startsWith("/")) url = window.location.origin + url;
        return url;
    }
    static combineUrls(a, b) {
        if (a.indexOf("?") != -1) a = a.substring(0, a.indexOf("?"));
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
    static findObjectsPath(obj, keyToFind, valueToFind) {
        // Base case: if obj is not an object, return null
        if (typeof obj !== 'object' || obj === null) return null;
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                // If the key matches, return the current object
                if (key == keyToFind && obj[key] == valueToFind) {
                    return [obj];
                }    
                // Recursively search within child objects
                if (typeof obj[key] === 'object') {
                    const result = Utils.findObjectsPath(obj[key], keyToFind, valueToFind);
                    if (result) {
                        if (!Array.isArray(obj)) result.unshift(obj);
                        return result;
                    }
                }
            }
        }    
        // If no matching object is found, return null
        return null;
    }
    static probablyPhone() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    static getDeepActiveElement(root = document) {
        // Get the active element within the given root (document or shadow root)
        let activeElement = root.activeElement;
      
        // If there's no active element, return null
        if (!activeElement) {
          return null;
        }      
        // If the active element has a shadow root, dive deeper
        if (activeElement.shadowRoot) {
          return Utils.getDeepActiveElement(activeElement.shadowRoot);
        }      
        // If active element is inside a shadow DOM slot, check its assigned elements
        if (activeElement.tagName === 'SLOT') {
          const assignedElements = activeElement.assignedElements({ flatten: true });
          for (const assignedElement of assignedElements) {
            if (assignedElement.shadowRoot) {
              const nestedActive = Utils.getDeepActiveElement(assignedElement.shadowRoot);
              if (nestedActive) {
                return nestedActive;
              }
            }
          }
        }      
        // Return the active element if it's the deepest focused element
        return activeElement;
    }
    static isDescendantOfElement(ancestor, element) {
        // Traverse through the ancestors of the element
        while (element) {

            if (element instanceof DocumentFragment) {
                element = element.host;
            }

            // Check if the current element is the ancestor
            if (element === ancestor) {
                return true;
            }
          
            // Check if the current element is inside a shadow DOM
            if (element.shadowRoot) {
                // Check if the ancestor is in the shadow DOM of the element
                if (element.shadowRoot.host === ancestor) {
                    return true;
                }
            }
          
            // Move to the parent node
            element = element.parentNode;
        }
        
        return false;
    }
    static getElementByIdRecursive(root, id) {
        // First, check if the current node has the ID we're looking for
        if (root.id === id) {
            return root;
        }
    
        // If the node is an element and has a shadow root, check the shadow root
        if (root.shadowRoot) {
            let shadowElement = Utils.getElementByIdRecursive(root.shadowRoot, id);
            if (shadowElement) {
                return shadowElement;
            }
        }
    
        // Otherwise, check all child nodes recursively
        for (let child of root.children) {
            let childElement = Utils.getElementByIdRecursive(child, id);
            if (childElement) {
                return childElement;
            }
        }
    
        // Return null if no element is found
        return null;
    }
    static findFocusableElement(element) {
        const focusableSelectors = [
            'a[href]', 
            'button:not([disabled])', 
            'textarea:not([disabled])', 
            'input:not([disabled])', 
            'select:not([disabled])', 
            '[tabindex]:not([tabindex="-1"])'
        ];

        // Helper to determine if an element is focusable
        const isFocusable = (el) => el.matches && el.matches(focusableSelectors.join(','));

        // Check if the current element is focusable
        if (isFocusable(element)) {
            return element;
        }

        // Traverse light DOM children
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            // Check shadow root if the element has it
            if (child.shadowRoot) {
                // Handle shadow DOM
                const focusableInShadow = Utils.findFocusableElement(child.shadowRoot);
                if (focusableInShadow) return focusableInShadow;

                // Check for slots and their assigned nodes
                const slots = child.shadowRoot.querySelectorAll('slot');
                for (let slot of slots) {
                    const assignedNodes = slot.assignedNodes({ flatten: true });
                    for (let node of assignedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const focusableInSlot = Utils.findFocusableElement(node);
                            if (focusableInSlot) return focusableInSlot;
                        }
                    }
                }
            }

            // Handle light DOM children
            const focusableInLight = Utils.findFocusableElement(child);
            if (focusableInLight) return focusableInLight;
        }

        // If no focusable element is found, return null
        return null;
    }
    static getAllElementsOfType(root, tagName) {
        const result = [];
        const tagNameUpper = tagName.toUpperCase(); // Normalize tagName for comparison
      
        function traverse(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node matches the tagName
            if (node.tagName === tagNameUpper) {
              result.push(node);
            }
      
            // Traverse child nodes in the light DOM
            node.childNodes.forEach(traverse);
      
            // If the node has a shadow root, traverse the shadow DOM
            if (node.shadowRoot) {
              traverse(node.shadowRoot);
            }
          }
        }
      
        traverse(root);
        return result;
    }
    

    // generate id
    static _counters = new Map();
    static generateId(prefix) {
        const current = Utils._counters.get(prefix) ?? 0;
        const nextValue = current + 1;
        Utils._counters.set(prefix, nextValue);
        return prefix + nextValue;
    };

    // rewrite document resource URLs
    static rewriteDocumentUrls(doc, rewriteFn) {
        // rules
        const rules = [
            { selector: "img", attr: "src" },
            { selector: "img", attr: "srcset" },
            { selector: "source", attr: "src" },
            { selector: "source", attr: "srcset" },
            { selector: "link", attr: "href" },
            { selector: "script", attr: "src" },
            { selector: "iframe", attr: "src" },
            { selector: "video", attr: "src" },
            { selector: "video", attr: "poster" },
            { selector: "audio", attr: "src" },
            { selector: "embed", attr: "src" },
            { selector: "object", attr: "data" },
            { selector: "object", attr: "archive" },
            { selector: "input[type=image]", attr: "src" },
            { selector: "track", attr: "src" },
            { selector: "area", attr: "href" },
            { selector: "form", attr: "action" },
            { selector: "button[formaction]", attr: "formaction" },
            { selector: "a", attr: "href" },
        ];
        // simple attribute rewrites
        for (const { selector, attr } of rules) {
            doc.querySelectorAll(selector).forEach(el => {
                const oldUrl = el.getAttribute(attr);
                if (!oldUrl) return;
                const newUrl = rewriteFn(el.localName, attr, oldUrl);
                if (newUrl !== oldUrl) el.setAttribute(attr, newUrl);
            });
        }
        // inline css styles
        doc.querySelectorAll("[style]").forEach(el => {
            const oldStyle = el.getAttribute("style");
            if (!oldStyle) return;
            const newStyle = oldStyle.replace(/url\(([^)]+)\)/g, (match, url) => {
                // strip quotes
                const clean = url.trim().replace(/^['"]|['"]$/g, "");
                return `url("${rewriteFn(el.localName, "style", clean)}")`;
            });
            el.setAttribute("style", newStyle);
        });
        // CSS inside <style> tags
        doc.querySelectorAll("style").forEach(style => {
            let css = style.textContent;
            css = css.replace(/url\(([^)]+)\)/g, (match, url) => {
                const clean = url.trim().replace(/^['"]|['"]$/g, "");
                return `url("${rewriteFn("style", "textContent", clean)}")`;
            });
            style.textContent = css;
        });
        // scripts imports
        const scripts = doc.querySelectorAll('script[type="module"]');
        for (const script of scripts) {
            if (!script.src) {
                const original = script.textContent;
                // regex to detect static imports
                const rewritten = original.replace(
                    /import\s+([^'"]*)['"]([^'"]+)['"]/g,
                    (match, bindings, importPath) => {
                        // resolve url
                        return `import ${bindings}"${rewriteFn("script", "textContent", importPath)}"`;
                    }
                );
                // create a new script because textContent would reset execution
                const newScript = document.createElement('script');
                newScript.type = 'module';
                newScript.textContent = rewritten;
                // replace content
                script.replaceWith(newScript);
            }
        }
        // return
        return doc;
    }


};


//export
export default Utils;