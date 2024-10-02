
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

    deepAssign(target, ...sources) {
        return deepAssign(target, ...sources);
    }

};


//export
export default new Utils();