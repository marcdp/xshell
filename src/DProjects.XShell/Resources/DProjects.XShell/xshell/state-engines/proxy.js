function cloneStructuralValue(value) {
	const json = JSON.stringify(value);
	return json === undefined ? value : JSON.parse(json);
}

function areStructurallyEqual(left, right) {
	if (Object.is(left, right)) return true;
	if (left === null || right === null || typeof(left) !== "object" || typeof(right) !== "object") return false;
	if (Array.isArray(left) || Array.isArray(right)) {
		return Array.isArray(left) && Array.isArray(right) && left.length === right.length
			&& left.every((value, index) => areStructurallyEqual(value, right[index]));
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length
		&& leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && areStructurallyEqual(left[key], right[key]));
}

// export
export default function createStateEngineFactoryProxy(stateSkeleton, context, options = {}) {
	
	// init state definition json
	const stateSkeletonJson = JSON.stringify(stateSkeleton || {});
	const changeDetection = options.changeDetection || {};

	// returns a state instance factory
	return {
		create: (handler) => {
			const value = JSON.parse(stateSkeletonJson);
			const structuralSnapshots = {};
			for (const [prop, mode] of Object.entries(changeDetection)) {
				if (mode === "structural") structuralSnapshots[prop] = cloneStructuralValue(value[prop]);
			}
			let listeners = [];
			return new Proxy(value, {
				get: function(target, prop, receiver) {
					// return real value
					if (prop == "addEventListener") {
						return function(event, listener) {
							if (event.startsWith("change:")) {
								let prop = event.substring("change:".length);
								listeners.push({prop: prop, listener});
							}
						}
					} else if (prop == "removeEventListener") {
						return function(event, listener) {
							if (event.startsWith("change:")) {
								let prop = event.substring("change:".length);
								listeners = listeners.filter(l => l.prop !== prop || l.listener !== listener);
							}
						}
					}
					return target[prop];
				},
				set(target, prop, newValue) {
					// set value and notify handler
					const structural = changeDetection[prop] === "structural";
					const oldValue = structural ? structuralSnapshots[prop] : target[prop];
					let changed;
					if (structural) {
						changed = !areStructurallyEqual(oldValue, newValue);
						target[prop] = newValue;
						structuralSnapshots[prop] = cloneStructuralValue(newValue);
					} else if (Array.isArray(newValue)) {
						changed = true;
					} else if (typeof(oldValue) === "object" && typeof(newValue) === "object") {
						changed = !Object.is(oldValue, newValue);
					} else {
						changed = oldValue !== newValue;
					}
					if (changed) {
						if (!structural) target[prop] = newValue;
						for (let listener of listeners) {
							if (listener.prop === prop) {
								listener.listener({ prop, newValue, oldValue});
							}
						}
						handler.stateChange(prop, oldValue, newValue);
						handler.invalidate(prop);
					}
					return true;
				}
			});
		}
	};
}
