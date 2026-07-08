

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.DwPasFI9.js","_app/immutable/chunks/DXpjE_LB.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/B05M60Wy.js"];
export const stylesheets = ["_app/immutable/assets/0.DtjBDgui.css"];
export const fonts = [];
