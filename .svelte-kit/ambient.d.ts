
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SVELTEKIT_FORK: string;
	export const NODE_ENV: string;
	export const WSLENV: string;
	export const HOSTTYPE: string;
	export const WSL2_GUI_APPS_ENABLED: string;
	export const npm_config_allow_scripts: string;
	export const npm_config_global_prefix: string;
	export const NVM_CD_FLAGS: string;
	export const npm_execpath: string;
	export const GIT_MERGE_AUTOEDIT: string;
	export const npm_config_init_module: string;
	export const npm_config_globalconfig: string;
	export const EDITOR: string;
	export const GIT_PAGER: string;
	export const INIT_CWD: string;
	export const DEBUGINFOD_URLS: string;
	export const COLOR: string;
	export const VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
	export const GIT_ASKPASS: string;
	export const WSL_DISTRO_NAME: string;
	export const LESSCLOSE: string;
	export const COPILOT_DEBUG_NONCE: string;
	export const NVM_DIR: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_package_json: string;
	export const COLORTERM: string;
	export const npm_config_user_agent: string;
	export const npm_config_local_prefix: string;
	export const npm_config_userconfig: string;
	export const RBENV_ROOT: string;
	export const NAME: string;
	export const npm_config_prefix: string;
	export const npm_lifecycle_event: string;
	export const NVM_INC: string;
	export const PYTHON_BASIC_REPL: string;
	export const PATH: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const VSCODE_IPC_HOOK_CLI: string;
	export const TERM_PROGRAM_VERSION: string;
	export const XDG_DATA_DIRS: string;
	export const LESSOPEN: string;
	export const SHLVL: string;
	export const npm_node_execpath: string;
	export const USER: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const HOME: string;
	export const WSL_INTEROP: string;
	export const PWD: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const WAYLAND_DISPLAY: string;
	export const GIT_EDITOR: string;
	export const AI_AGENT: string;
	export const npm_config_cache: string;
	export const npm_config_noproxy: string;
	export const npm_command: string;
	export const LOGNAME: string;
	export const TERM: string;
	export const PYTHONSTARTUP: string;
	export const PULSE_SERVER: string;
	export const _: string;
	export const npm_config_npm_version: string;
	export const HISTCONTROL: string;
	export const NODE: string;
	export const npm_package_name: string;
	export const XDG_RUNTIME_DIR: string;
	export const DISPLAY: string;
	export const LANG: string;
	export const LS_COLORS: string;
	export const TERM_PROGRAM: string;
	export const COPILOT_AGENT: string;
	export const npm_lifecycle_script: string;
	export const npm_package_version: string;
	export const DEBIAN_FRONTEND: string;
	export const npm_config_node_gyp: string;
	export const RBENV_SHELL: string;
	export const SHELL: string;
	export const NVM_BIN: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SVELTEKIT_FORK: string;
		NODE_ENV: string;
		WSLENV: string;
		HOSTTYPE: string;
		WSL2_GUI_APPS_ENABLED: string;
		npm_config_allow_scripts: string;
		npm_config_global_prefix: string;
		NVM_CD_FLAGS: string;
		npm_execpath: string;
		GIT_MERGE_AUTOEDIT: string;
		npm_config_init_module: string;
		npm_config_globalconfig: string;
		EDITOR: string;
		GIT_PAGER: string;
		INIT_CWD: string;
		DEBUGINFOD_URLS: string;
		COLOR: string;
		VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
		GIT_ASKPASS: string;
		WSL_DISTRO_NAME: string;
		LESSCLOSE: string;
		COPILOT_DEBUG_NONCE: string;
		NVM_DIR: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_package_json: string;
		COLORTERM: string;
		npm_config_user_agent: string;
		npm_config_local_prefix: string;
		npm_config_userconfig: string;
		RBENV_ROOT: string;
		NAME: string;
		npm_config_prefix: string;
		npm_lifecycle_event: string;
		NVM_INC: string;
		PYTHON_BASIC_REPL: string;
		PATH: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		VSCODE_IPC_HOOK_CLI: string;
		TERM_PROGRAM_VERSION: string;
		XDG_DATA_DIRS: string;
		LESSOPEN: string;
		SHLVL: string;
		npm_node_execpath: string;
		USER: string;
		VSCODE_GIT_IPC_HANDLE: string;
		HOME: string;
		WSL_INTEROP: string;
		PWD: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		WAYLAND_DISPLAY: string;
		GIT_EDITOR: string;
		AI_AGENT: string;
		npm_config_cache: string;
		npm_config_noproxy: string;
		npm_command: string;
		LOGNAME: string;
		TERM: string;
		PYTHONSTARTUP: string;
		PULSE_SERVER: string;
		_: string;
		npm_config_npm_version: string;
		HISTCONTROL: string;
		NODE: string;
		npm_package_name: string;
		XDG_RUNTIME_DIR: string;
		DISPLAY: string;
		LANG: string;
		LS_COLORS: string;
		TERM_PROGRAM: string;
		COPILOT_AGENT: string;
		npm_lifecycle_script: string;
		npm_package_version: string;
		DEBIAN_FRONTEND: string;
		npm_config_node_gyp: string;
		RBENV_SHELL: string;
		SHELL: string;
		NVM_BIN: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
