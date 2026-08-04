<?php
/**
 * Schema: payments.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class PaymentsTable {

	public const NAME = 'payments';

	/** Bank transfer is the only method supported today. */
	public const METHODS = array( 'transfer', 'cash', 'card' );

	public const STATUSES = array( 'pending', 'paid', 'failed', 'refunded' );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `invoice_no` is NULL-able so the UNIQUE key tolerates a payment
		// recorded before an invoice is raised.
		// `proof_attachment_id` points at the receipt or screenshot the guest
		// uploaded, stored in the media library.
		// `amount` may be negative to record a refund against the booking.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			booking_id bigint(20) unsigned NOT NULL,
			method varchar(20) NOT NULL default 'transfer',
			status varchar(20) NOT NULL default 'pending',
			amount decimal(10,2) NOT NULL default 0.00,
			currency char(3) NOT NULL default 'EUR',
			invoice_no varchar(64) NULL default NULL,
			proof_attachment_id bigint(20) unsigned NULL default NULL,
			reference varchar(191) NOT NULL default '',
			paid_at datetime NULL default NULL,
			notes longtext NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY invoice_no (invoice_no),
			KEY booking_id (booking_id),
			KEY status (status)
		) $collate;";
	}
}
