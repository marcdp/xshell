import {rewriteDocumentUrls} from "../utils/rewriteDocumentUrls.js";

// export
export class RenderEnginePlain {
	
	// ctor
	constructor({ host, template, state }){
		this._host = host;
		this._template = template.cloneNode(true);
		this._state = state;
	}

	// methods
	mount() {
		// add fragment to host DOM
		this._host.appendChild(this._template.content);
	}
	invalidate() {
		// No-op (plain HTML is static)
	}
	unmount() {
		// Cleanup if needed in the future
		this._host.replaceChildren();
		this._template = null;
	}


}
export default function createRenderEngineFactoryPlain(template, context) {
	// template
	const templateElement = document.createElement("TEMPLATE");
	templateElement.innerHTML = template;
	// dependencies
	const dependencies = new Set();
	templateElement.content.querySelectorAll("*").forEach(el => {
		if (el.tagName.includes("-")) {
			if (context.componentLazy && (el.localName != context.componentLazy && el.closest(context.componentLazy) != null)) return;
			dependencies.add("component:" + el.tagName.toLowerCase());
		}
	});
	// url rewrite
	rewriteDocumentUrls(templateElement.content, context)
	// return
	return {
		dependencies: Object.freeze(Object.seal([...dependencies])),
		create: ({host, state}) => {
			return new RenderEnginePlain({ host, template: templateElement, state });
		}
	};
}