
// funcs
function deepAssign(obj1, obj2) {
    for (let key in obj2) {
        if (Object.prototype.hasOwnProperty.call(obj2, key)) {
            if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
                for(let item of obj2[key]){
                    if (obj1[key].indexOf(item) == -1){
                        obj1[key].push(item);    
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


// class
class Utils {

    static deepAssign(target, ...sources) {
        return deepAssign(target, ...sources);
    }
    static traverse(obj, callback) {
        for (let key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (obj[key] instanceof Object) {
                    this.traverse(obj[key], callback);
                } else {
                    callback(obj, key);
                }
            }
        }
    }
    static combineUrls(a, b) {
        if (b.indexOf(":") != -1) return b;
        if (b.startsWith("./")) {
            if (a.endsWith("/")) a = a.substring(0, a.length - 1);
            return a + b.substring(1);
        } else if (b.startsWith("../")) {
            if (a.endsWith("/")) a = a.substring(0, a.length - 1);
            return a + b.substring(2);
        } else if (b.startsWith("/")) {
            if (a.indexOf("://") != -1) {
                let i = a.indexOf("/", a.indexOf("://") + 3);
                if (i != -1) a = a.substring(0, i);
                return a + b;
            }
            return b;
        } else {
            if (!a.endsWith("/")) a += "/";
            return a + b;
        }
      }

};


//export
export default Utils;