import { o as slot } from "../../chunks/server.js";
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.push(`<!--[-->`);
	slot($$renderer, $$props, "default", {}, null);
	$$renderer.push(`<!--]-->`);
}
//#endregion
export { _layout as default };
