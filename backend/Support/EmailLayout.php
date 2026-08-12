<?php
/**
 * The HTML shell every guest email is sent in.
 *
 * Templates hold only their own content. The frame around it — the logo, the
 * accent colour, the footer — is built here, so rebranding is one setting
 * rather than an edit to all three templates.
 *
 * Email clients are not browsers. Outlook renders with Word, Gmail strips
 * anything in <head>, and support for modern layout is patchy, so this is
 * deliberately old-fashioned: tables for structure, inline styles throughout,
 * and no shorthand a client might drop. Every choice here is one that renders
 * the same in Outlook, Apple Mail and Gmail.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\SettingsRepository;

defined( 'ABSPATH' ) || exit;

final class EmailLayout {

	private const INK   = '#1f2937';
	private const MUTED = '#6b7280';
	private const LINE  = '#e5e7eb';
	private const PAPER = '#f4f5f7';

	/** Kept narrow enough to stay readable in a preview pane. */
	private const WIDTH = 600;

	/**
	 * Wrap a template's body in the layout.
	 *
	 * @param string $body    The template body, already token-replaced.
	 * @param string $subject Used as the document title.
	 */
	public static function wrap( string $body, string $subject = '' ): string {
		$palette = SettingsRepository::accent_palette();
		$accent  = $palette['brand'];

		$site = (string) get_bloginfo( 'name' );
		$logo = self::logo();

		$header = null !== $logo
			? sprintf(
				'<img src="%1$s" alt="%2$s" width="160" style="display:block;border:0;outline:none;text-decoration:none;max-width:160px;height:auto;">',
				esc_url( $logo ),
				esc_attr( $site )
			)
			: sprintf(
				'<span style="font-size:20px;font-weight:700;color:%1$s;">%2$s</span>',
				esc_attr( $accent ),
				esc_html( $site )
			);

		return sprintf(
			'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
			. '<html xmlns="http://www.w3.org/1999/xhtml"><head>'
			. '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
			. '<meta name="viewport" content="width=device-width, initial-scale=1" />'
			. '<title>%1$s</title></head>'
			. '<body style="margin:0;padding:0;background-color:%2$s;">'
			// The outer table is the page; some clients ignore a body background.
			. '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0"'
			. ' style="background-color:%2$s;margin:0;padding:0;">'
			. '<tr><td align="center" style="padding:24px 12px;">'
			. '<table role="presentation" width="%3$d" cellpadding="0" cellspacing="0" border="0"'
			. ' style="width:%3$dpx;max-width:100%%;background-color:#ffffff;border:1px solid %4$s;'
			. 'border-radius:8px;overflow:hidden;">'
			// A rule in the accent colour, rather than a heavy coloured banner.
			. '<tr><td style="height:4px;line-height:4px;font-size:0;background-color:%5$s;">&nbsp;</td></tr>'
			. '<tr><td style="padding:28px 32px 8px 32px;">%6$s</td></tr>'
			. '<tr><td style="padding:8px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;'
			. 'font-size:15px;line-height:24px;color:%7$s;">%8$s</td></tr>'
			. '<tr><td style="padding:0 32px;"><div style="border-top:1px solid %4$s;font-size:0;'
			. 'line-height:0;">&nbsp;</div></td></tr>'
			. '<tr><td style="padding:20px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;'
			. 'font-size:12px;line-height:19px;color:%9$s;">%10$s</td></tr>'
			. '</table></td></tr></table></body></html>',
			esc_html( '' !== $subject ? $subject : $site ),
			self::PAPER,
			self::WIDTH,
			self::LINE,
			esc_attr( $accent ),
			$header,
			self::INK,
			self::content( $body, $accent ),
			self::MUTED,
			self::footer()
		);
	}

	/**
	 * A plain-text version, for clients that will not show HTML and for the
	 * spam filters that expect a multipart message to carry one.
	 */
	public static function to_text( string $html ): string {
		// <title> is text too, and stripping tags alone would leave the subject
		// sitting at the top of the message a second time.
		$text = preg_replace( '#<head\b.*?</head>#is', '', $html ) ?? $html;

		$text = preg_replace( '#<(br|/p|/div|/tr|/h[1-6])[^>]*>#i', "\n", $text ) ?? $text;

		// A header cell labels the cell beside it, so it reads as "Label: value";
		// a closing data cell ends the line. Doing both with one separator left
		// a colon dangling at the end of every row.
		$text = preg_replace( '#</th\s*>#i', ': ', $text ) ?? $text;
		$text = preg_replace( '#</td\s*>#i', "\n", $text ) ?? $text;
		$text = wp_strip_all_tags( $text );
		$text = html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		// Collapse the runs of blank lines the stripping leaves behind.
		$text = preg_replace( "/[ \t]+\n/", "\n", $text ) ?? $text;
		$text = preg_replace( "/\n{3,}/", "\n\n", $text ) ?? $text;

		return trim( $text );
	}

	/**
	 * Prepare a stored body for sending.
	 *
	 * Templates written before this was HTML are plain text; their line breaks
	 * are the whole of their formatting, so they are run through wpautop and
	 * keep working untouched. A body that already contains markup is left
	 * exactly as written.
	 */
	public static function content( string $body, string $accent ): string {
		$html = self::is_html( $body ) ? $body : wpautop( $body );

		/*
		 * Gmail drops <style> blocks, so the few elements a template is likely
		 * to use are given their styles inline here rather than in a stylesheet
		 * the author would have to maintain.
		 */
		$inline = array(
			'<p>'  => '<p style="margin:0 0 16px 0;">',
			'<h1>' => '<h1 style="margin:0 0 12px 0;font-size:22px;line-height:28px;font-weight:700;color:' . $accent . ';">',
			'<h2>' => '<h2 style="margin:24px 0 10px 0;font-size:18px;line-height:24px;font-weight:700;color:' . self::INK . ';">',
			'<h3>' => '<h3 style="margin:20px 0 8px 0;font-size:15px;line-height:22px;font-weight:700;color:' . self::INK . ';">',
			'<ul>' => '<ul style="margin:0 0 16px 0;padding-left:20px;">',
			'<ol>' => '<ol style="margin:0 0 16px 0;padding-left:20px;">',
			'<li>' => '<li style="margin:0 0 6px 0;">',
			'<a '  => '<a style="color:' . $accent . ';text-decoration:underline;" ',
			'<hr>' => '<hr style="border:0;border-top:1px solid ' . self::LINE . ';margin:24px 0;">',
			'<blockquote>' => '<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ' . $accent . ';background-color:' . self::PAPER . ';">',
			'<table>' => '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">',
			'<td>' => '<td style="padding:6px 0;border-bottom:1px solid ' . self::LINE . ';font-size:14px;">',
			'<th>' => '<th align="left" style="padding:6px 0;border-bottom:1px solid ' . self::LINE . ';font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:' . self::MUTED . ';">',
		);

		return strtr( $html, $inline );
	}

	/**
	 * Whether a body was written as HTML.
	 *
	 * A bare `<` in prose ("under 10 < 20") is not markup, so this looks for a
	 * real tag rather than any angle bracket.
	 */
	public static function is_html( string $body ): bool {
		return 1 === preg_match( '#</?[a-z][a-z0-9]*(\s[^>]*)?>#i', $body );
	}

	private static function footer(): string {
		$site = (string) get_bloginfo( 'name' );
		$url  = (string) home_url();

		return sprintf(
			'%1$s<br /><a href="%2$s" style="color:%3$s;text-decoration:underline;">%4$s</a>',
			esc_html( $site ),
			esc_url( $url ),
			self::MUTED,
			esc_html( (string) wp_parse_url( $url, PHP_URL_HOST ) )
		);
	}

	/**
	 * The invoice logo doubles as the email logo: one image, one upload, and
	 * the two documents a guest receives look like each other.
	 */
	private static function logo(): ?string {
		$id = SettingsRepository::logo_id();

		if ( ! $id || 'attachment' !== get_post_type( $id ) ) {
			return null;
		}

		$url = wp_get_attachment_image_url( $id, 'medium' );

		return is_string( $url ) && '' !== $url ? $url : null;
	}
}
