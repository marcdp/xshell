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
     

};


//export
export default Utils;