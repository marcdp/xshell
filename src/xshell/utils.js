
// class
export default class Utils {

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

