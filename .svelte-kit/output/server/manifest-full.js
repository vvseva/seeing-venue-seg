export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.B71889Jl.js",app:"_app/immutable/entry/app.BmIl1gT0.js",imports:["_app/immutable/entry/start.B71889Jl.js","_app/immutable/chunks/b_MGneF9.js","_app/immutable/chunks/DXpjE_LB.js","_app/immutable/chunks/BG_VV7nw.js","_app/immutable/entry/app.BmIl1gT0.js","_app/immutable/chunks/DXpjE_LB.js","_app/immutable/chunks/DYl5dUZ5.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
