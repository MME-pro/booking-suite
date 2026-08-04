/**
 * Error thrown for any non-2xx response, or for a request that never reached
 * the server.
 *
 * WordPress reports failures as { code, message, data: { status, field } }, so
 * that shape is unpacked here once and every caller can rely on it.
 */

export default class ApiError extends Error {
	constructor(
		message,
		{ code = '', status = 0, field = '', data = null } = {}
	) {
		super( message );

		this.name = 'ApiError';
		this.code = code;
		this.status = status;

		/** Column the failure belongs to, when the server named one. */
		this.field = field;
		this.data = data;
	}

	/** No response at all — offline, DNS, CORS, aborted. */
	get isNetworkError() {
		return 0 === this.status;
	}

	/** The nonce expired, or the session is no longer logged in. */
	get isAuthError() {
		return 401 === this.status || 403 === this.status;
	}

	get isConflict() {
		return 409 === this.status;
	}
}
