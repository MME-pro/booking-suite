/**
 * HTTP client with interceptors.
 *
 * Everything that talks to the REST API goes through here, so cross-cutting
 * concerns — the nonce, JSON encoding, error shaping — live in one place
 * instead of in every service.
 *
 * Interceptors run in registration order:
 *
 *   request   ( config )            → config
 *   response  ( payload, context )  → payload
 *   error     ( ApiError, context ) → ApiError  (may also throw)
 *
 * Each returns the (possibly replaced) value it was handed. An interceptor
 * that returns nothing leaves the value untouched.
 */

import { __ } from '@wordpress/i18n';

import { settings } from '../settings';
import ApiError from './ApiError';

const interceptors = {
	request: [],
	response: [],
	error: [],
};

const register = ( kind ) => ( handler ) => {
	interceptors[ kind ].push( handler );

	// Returns an unsubscribe, so tests and one-off screens can clean up.
	return () => {
		const index = interceptors[ kind ].indexOf( handler );

		if ( index > -1 ) {
			interceptors[ kind ].splice( index, 1 );
		}
	};
};

export const addRequestInterceptor = register( 'request' );
export const addResponseInterceptor = register( 'response' );
export const addErrorInterceptor = register( 'error' );

const runInterceptors = ( kind, value, context ) =>
	interceptors[ kind ].reduce( ( carry, handler ) => {
		const result = handler( carry, context );

		return undefined === result ? carry : result;
	}, value );

// Absolute URL for a path relative to the plugin's REST namespace.
const buildUrl = ( path, query ) => {
	const base = settings.restUrl.replace( /\/$/, '' );
	const url = new URL( `${ base }/${ String( path ).replace( /^\//, '' ) }` );

	Object.entries( query ?? {} ).forEach( ( [ key, value ] ) => {
		if ( undefined === value || null === value || '' === value ) {
			return;
		}

		url.searchParams.set( key, value );
	} );

	return url.toString();
};

// Turn a WordPress error body into an ApiError.
const toApiError = ( payload, status ) => {
	if ( payload && 'object' === typeof payload && payload.code ) {
		return new ApiError(
			payload.message ?? __( 'Request failed.', 'booking-suite' ),
			{
				code: payload.code,
				status: payload.data?.status ?? status,
				field: payload.data?.field ?? '',
				data: payload.data ?? null,
			}
		);
	}

	return new ApiError( __( 'Request failed.', 'booking-suite' ), { status } );
};

/**
 * Baseline interceptors. Registered here rather than inside request() so they
 * can be inspected, reordered or removed like any other.
 */

// Authenticate every call with the REST nonce handed over by PHP.
addRequestInterceptor( ( config ) => ( {
	...config,
	headers: {
		Accept: 'application/json',
		'X-WP-Nonce': settings.nonce,
		...( undefined === config.body
			? {}
			: { 'Content-Type': 'application/json' } ),
		...config.headers,
	},
} ) );

// A stale nonce is the most common failure in a long-lived admin tab; say so
// rather than surfacing the raw "cookie check failed" text.
addErrorInterceptor( ( error ) => {
	if ( error.isAuthError ) {
		return new ApiError(
			__(
				'Your session expired. Reload the page and try again.',
				'booking-suite'
			),
			{ code: error.code, status: error.status, field: error.field }
		);
	}

	return error;
} );

/**
 * Perform a request.
 *
 * @param {Object}      options
 * @param {string}      options.method    HTTP verb.
 * @param {string}      options.path      Path relative to the REST namespace.
 * @param {Object}      [options.query]   Query parameters; empty values are dropped.
 * @param {*}           [options.body]    JSON-encoded when present.
 * @param {Object}      [options.headers]
 * @param {AbortSignal} [options.signal]
 * @return {Promise<*>} Parsed response body.
 */
export async function request( options ) {
	const config = runInterceptors( 'request', {
		method: 'GET',
		headers: {},
		...options,
	} );

	const url = buildUrl( config.path, config.query );

	let response;

	try {
		response = await fetch( url, {
			method: config.method,
			headers: config.headers,
			credentials: 'same-origin',
			signal: config.signal,
			body:
				undefined === config.body
					? undefined
					: JSON.stringify( config.body ),
		} );
	} catch ( cause ) {
		// Aborts are a caller decision, not a failure to report.
		if ( 'AbortError' === cause.name ) {
			throw cause;
		}

		throw runInterceptors(
			'error',
			new ApiError(
				__( 'Could not reach the server.', 'booking-suite' ),
				{ code: 'network_error' }
			),
			{ config }
		);
	}

	// 204 and empty bodies are legitimate; do not try to parse them.
	const text = await response.text();
	const payload = text ? JSON.parse( text ) : null;

	if ( ! response.ok ) {
		throw runInterceptors(
			'error',
			toApiError( payload, response.status ),
			{
				config,
				response,
			}
		);
	}

	return runInterceptors( 'response', payload, { config, response } );
}

export const http = {
	get: ( path, query, options ) =>
		request( { ...options, method: 'GET', path, query } ),
	post: ( path, body, options ) =>
		request( { ...options, method: 'POST', path, body } ),
	put: ( path, body, options ) =>
		request( { ...options, method: 'PUT', path, body } ),
	delete: ( path, options ) =>
		request( { ...options, method: 'DELETE', path } ),
};
