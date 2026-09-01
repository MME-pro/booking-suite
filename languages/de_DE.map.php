<?php
/**
 * German translations, keyed by source string.
 *
 * The authored source of the catalogue: tools/i18n-build.php merges this with
 * the extracted .pot to produce the .po, .mo and the JSON files the JavaScript
 * bundles load. Edit here, then re-run the build — never edit the .po by hand,
 * because the next build overwrites it.
 *
 * A plural entry is array( singular, plural ). Placeholders (%s, %d, %1$s) and
 * the {{token}} names in email templates must survive translation untouched;
 * the build script verifies both and refuses to compile if any drifted.
 *
 * Guest-facing text uses the formal "Sie" throughout, which is what a German
 * visitor expects from a business.
 *
 * @package BookingSuite
 */

return array(
	'"%s" will be removed and detached from any booking it was added to. Those bookings keep the total they were taken at. This cannot be undone.' => '„%s“ wird entfernt und von allen Buchungen gelöst, zu denen es hinzugefügt wurde. Diese Buchungen behalten den Betrag, zu dem sie erfasst wurden. Das kann nicht rückgängig gemacht werden.',
	'"%s" will be removed. This cannot be undone.' => '„%s“ wird entfernt. Das kann nicht rückgängig gemacht werden.',
	'%1$d extra guests × %2$s'    => '%1$d zusätzliche Gäste × %2$s',
	'%1$d extra hours × %2$s'     => '%1$d zusätzliche Stunden × %2$s',
	'%1$d of %2$d occupied'       => '%1$d von %2$d belegt',
	'%1$d of %2$d templates on'   => '%1$d von %2$d Vorlagen aktiv',
	'%1$s from %2$s · %3$s'       => '%1$s ab %2$s · %3$s',
	'%1$s → %2$s · %3$s'          => '%1$s → %2$s · %3$s',
	'%1$s, %2$s'                  => '%1$s, %2$s',
	'%d active'                   => '%d aktiv',
	'%d all time'                 => '%d insgesamt',
	'%d B'                        => '%d B',
	'%d KB'                       => '%d KB',
	'%dx'                       => '%dx',
	'%1$s (Extra) — %2$s je Stück' => '%1$s (Extra) — %2$s je Stück',
	'%s (Extra)'                => '%s (Extra)',
	'%s gebuchtes Zimmer'       => '%s gebuchtes Zimmer',
	'%s MB'                       => '%s MB',
	'%s Std.'                   => '%s Std.',
	'/ %s'                        => '/ %s',
	'A screenshot or receipt of your transfer is required before you can continue.' => 'Ein Screenshot oder Beleg Ihrer Überweisung ist erforderlich, bevor Sie fortfahren können.',
	'Absender:'                 => 'Absender:',
	'Anzahl der Std.'           => 'Anzahl der Std.',
	'Beschreibung'              => 'Beschreibung',
	'Buchungsnummer:'           => 'Buchungsnummer:',
	'Choose a logo'             => 'Logo auswählen',
	'Choose logo'               => 'Logo wählen',
	'Closing line'              => 'Schlusszeile',
	'Datum'                     => 'Datum',
	'Datum:'                    => 'Datum:',
	'Days from the invoice date to the due date.' => 'Tage vom Rechnungsdatum bis zur Fälligkeit.',
	'E-Mail:'                   => 'E-Mail:',
	'Fälligkeitsdatum:'        => 'Fälligkeitsdatum:',
	'Gebuchte Uhrzeit'          => 'Gebuchte Uhrzeit',
	'Gesamt:'                   => 'Gesamt:',
	'Gesamtbetrag:'             => 'Gesamtbetrag:',
	'Hinweis:'                  => 'Hinweis:',
	'Invoice generator'         => 'Rechnungsgenerator',
	'Invoice logo'              => 'Rechnungslogo',
	'Invoice number prefix'     => 'Präfix der Rechnungsnummer',
	'Kosten'                    => 'Kosten',
	'Logo'                      => 'Logo',
	'Netto:'                    => 'Netto:',
	'Notice'                    => 'Hinweis',
	'Numbers run PREFIX-YEAR-0001 and restart each year.' => 'Die Nummern lauten PRÄFIX-JAHR-0001 und beginnen jedes Jahr neu.',
	'Payment term (days)'       => 'Zahlungsziel (Tage)',
	'Please upload a screenshot or receipt of your payment to complete the booking.' => 'Bitte laden Sie einen Screenshot oder Beleg Ihrer Zahlung hoch, um die Buchung abzuschließen.',
	'Printed at the top left of the invoice.' => 'Wird oben links auf der Rechnung gedruckt.',
	'Printed last, after a bold "Hinweis:" label.' => 'Wird zuletzt gedruckt, nach einem fett gesetzten "Hinweis:".',
	'Printed on the right, one line per line — company, address, telephone, email, VAT number.' => 'Wird rechts gedruckt, eine Zeile je Zeile — Firma, Adresse, Telefon, E-Mail, USt-IdNr.',
	'RECHNUNG'                  => 'RECHNUNG',
	'Rechnung'                  => 'Rechnung',
	'Rechnungsempfänger:'      => 'Rechnungsempfänger:',
	'Rechnungsnummer:'          => 'Rechnungsnummer:',
	'Replace logo'              => 'Logo ersetzen',
	'required'                    => 'erforderlich',
	'Any time'                    => 'Beliebige Uhrzeit',
	'Click or drop your payment screenshot here' => 'Zahlungsbeleg hier ablegen oder klicken',
	'JPG, PNG, WEBP or PDF · up to %s' => 'JPG, PNG, WEBP oder PDF · bis %s',
	'Ready'                       => 'Bereit',
	'Ready · %s'                  => 'Bereit · %s',
	'Replace'                     => 'Ersetzen',
	'Sender block'              => 'Absenderblock',
	'Tel: %s'                   => 'Tel: %s',
	'Telefon:'                  => 'Telefon:',
	'Telephone'                 => 'Telefon',
	'That file could not be read.' => 'Diese Datei konnte nicht gelesen werden.',
	'That file is too large. The most we can take is %s.' => 'Diese Datei ist zu groß. Höchstens %s sind möglich.',
	'That file type is not supported. Use a JPG, PNG, WEBP or PDF.' => 'Dieser Dateityp wird nicht unterstützt. Bitte JPG, PNG, WEBP oder PDF verwenden.',
	'The invoice sent to the guest as a PDF when a payment is marked paid.' => 'Die Rechnung, die dem Gast als PDF gesendet wird, sobald eine Zahlung als bezahlt markiert wird.',
	'The payment receipt you uploaded' => 'Der von Ihnen hochgeladene Zahlungsbeleg',
	'Time'                        => 'Uhrzeit',
	'%d apartment'                => array( '%d Apartment', '%d Apartments' ),
	'%d apartment found'          => array( '%d Apartment gefunden', '%d Apartments gefunden' ),
	'%d arriving'                 => '%d Anreisen',
	'%d booking'                  => array( '%d Buchung', '%d Buchungen' ),
	'%d booking on this day'      => array( '%d Buchung an diesem Tag', '%d Buchungen an diesem Tag' ),
	'%d customer'                 => array( '%d Kunde', '%d Kunden' ),
	'%d departing'                => '%d Abreisen',
	'%d endpoints'                => '%d Endpunkte',
	'%d extra'                    => array( '%d Extra', '%d Extras' ),
	'%d failed'                   => '%d fehlgeschlagen',
	'%d guest'                    => array( '%d Gast', '%d Gäste' ),
	'%d hour'                     => array( '%d Stunde', '%d Stunden' ),
	'%d in house'                 => '%d im Haus',
	'%d infant'                   => array( '%d Kleinkind', '%d Kleinkinder' ),
	'%d left'                     => 'noch %d',
	'%d lock in place'            => array( '%d Sperre aktiv', '%d Sperren aktiv' ),
	'%d min'                      => '%d Min.',
	'%d minute'                   => array( '%d Minute', '%d Minuten' ),
	'%d minutes'                  => '%d Minuten',
	'%d night'                    => array( '%d Nacht', '%d Nächte' ),
	'%d on the selected day'      => '%d am gewählten Tag',
	'%d paid'                     => '%d bezahlt',
	'%d payment'                  => array( '%d Zahlung', '%d Zahlungen' ),
	'%d pending'                  => '%d ausstehend',
	'%d photo'                    => array( '%d Foto', '%d Fotos' ),
	'%d stay'                     => array( '%d Aufenthalt', '%d Aufenthalte' ),
	'%d tables missing'           => '%d Tabellen fehlen',
	'%d tables, up to date'       => '%d Tabellen, aktuell',
	'%d total'                    => '%d gesamt',
	'%d%% operational'            => '%d%% betriebsbereit',
	'%d%% return'                 => '%d%% wiederkehrend',
	'%dN'                         => '%dN',
	'%s hours'                    => '%s Stunden',
	'%s is no longer available for these dates. Please adjust it and try again.' => '%s ist für diesen Zeitraum nicht mehr verfügbar. Bitte passen Sie die Auswahl an und versuchen Sie es erneut.',
	'%s lifetime'                 => '%s gesamt',
	'%s total'                    => '%s gesamt',
	'%sh'                         => '%s Std.',
	'/ night'                     => '/ Nacht',
	'100% Ready'                  => '100 % bereit',
	'13 or older'                 => '13 Jahre und älter',
	'30 days'                     => '30 Tage',
	'7 days'                      => '7 Tage',
	'90 days'                     => '90 Tage',
	'A button that opens the booking modal. Added to every apartment page automatically, so you only need this to place it somewhere specific instead.' => 'Eine Schaltfläche, die das Buchungsfenster öffnet. Sie wird automatisch auf jeder Apartment-Seite ergänzt — dieser Shortcode wird nur gebraucht, um sie an einer bestimmten Stelle zu platzieren.',
	'A name is required.'         => 'Ein Name ist erforderlich.',
	'A photo grid of the apartments with a "Book now" button on each card, for the homepage. Rendered by the server, so it is visible to search engines and needs no search bar. Use the apartment list instead when guests should filter by date first.' => 'Ein Fotoraster der Apartments mit einer „Jetzt buchen“-Schaltfläche auf jeder Karte, für die Startseite. Es wird auf dem Server erzeugt, ist damit für Suchmaschinen sichtbar und braucht keine Suchleiste. Verwenden Sie die Apartment-Liste, wenn Gäste zuerst nach Datum filtern sollen.',
	'A star marks a required parameter. Hover any parameter for its type, or its allowed values where it has a fixed set.' => 'Ein Stern kennzeichnet einen Pflichtparameter. Fahren Sie über einen Parameter, um seinen Typ zu sehen — oder die erlaubten Werte, wenn es eine feste Auswahl gibt.',
	'API endpoints'               => 'API-Endpunkte',
	'Accent colour'               => 'Akzentfarbe',
	'Accent colour hex'           => 'Akzentfarbe als Hex-Wert',
	'Access'                      => 'Zugriff',
	'Across every booking'        => 'Über alle Buchungen',
	'Across every booking listed' => 'Über alle aufgeführten Buchungen',
	'Actions'                     => 'Aktionen',
	'Activate'                    => 'Aktivieren',
	'Activate %s'                 => '%s aktivieren',
	'Active'                      => 'Aktiv',
	'Active (visible to customers)' => 'Aktiv (für Kunden sichtbar)',
	'Active Units'                => 'Aktive Einheiten',
	'Active — guests can book this apartment' => 'Aktiv — Gäste können dieses Apartment buchen',
	'Add Apartment'               => 'Apartment hinzufügen',
	'Add Booking'                 => 'Buchung hinzufügen',
	'Add Extra'                   => 'Extra hinzufügen',
	'Add New Extra'               => 'Neues Extra hinzufügen',
	'Add an extra — a breakfast, a parking space, a projector — and guests can add it while booking.' => 'Legen Sie ein Extra an — ein Frühstück, einen Stellplatz, einen Beamer — und Gäste können es beim Buchen dazunehmen.',
	'Add booking'                 => 'Buchung hinzufügen',
	'Add one'                     => 'Eines anlegen',
	'Add photos'                  => 'Fotos hinzufügen',
	'Add your first apartment and its numbers will show up here.' => 'Legen Sie Ihr erstes Apartment an — die Zahlen dazu erscheinen dann hier.',
	'Add your first apartment to start taking bookings for it.' => 'Legen Sie Ihr erstes Apartment an, um Buchungen dafür anzunehmen.',
	'Address'                     => 'Adresse',
	'Admin'                       => 'Admin',
	'Adults'                      => 'Erwachsene',
	'Ages 2 to 12'                => '2 bis 12 Jahre',
	'All'                         => 'Alle',
	'All Apartments'              => 'Alle Apartments',
	'All Methods'                 => 'Alle Zahlungsarten',
	'All Statuses'                => 'Alle Status',
	'All available'               => 'Alle verfügbar',
	'All bookable'                => 'Alle buchbar',
	'All clear'                   => 'Alles frei',
	'All live'                    => 'Alle aktiv',
	'All templates off'           => 'Alle Vorlagen aus',
	'All time'                    => 'Gesamter Zeitraum',
	'Already booked'              => 'Bereits gebucht',
	'Amount'                      => 'Betrag',
	'Another booking already holds those dates.' => 'Eine andere Buchung belegt diesen Zeitraum bereits.',
	'Another booking already holds those dates. Cancel that one first.' => 'Eine andere Buchung belegt diesen Zeitraum bereits. Stornieren Sie zuerst jene Buchung.',
	'Any'                         => 'Beliebig',
	'Any date'                    => 'Beliebiges Datum',
	'Anything we should know?'    => 'Gibt es etwas, das wir wissen sollten?',
	'Apartment'                   => 'Apartment',
	'Apartment list'              => 'Apartment-Liste',
	'Apartment name'              => 'Name des Apartments',
	'Apartment not found.'        => 'Apartment nicht gefunden.',
	'Apartment photos'            => 'Apartment-Fotos',
	'Apartment showcase'          => 'Apartment-Schaufenster',
	'Apartment to book. Defaults to the apartment being rendered, which is what makes it work unchanged inside an Elementor loop.' => 'Das zu buchende Apartment. Standardmäßig das gerade dargestellte Apartment — dadurch funktioniert der Shortcode unverändert innerhalb einer Elementor-Schleife.',
	'Apartment: Booking link'     => 'Apartment: Buchungslink',
	'Apartment: Cleaning time'    => 'Apartment: Reinigungszeit',
	'Apartment: Colour'           => 'Apartment: Farbe',
	'Apartment: Description'      => 'Apartment: Beschreibung',
	'Apartment: Guests'           => 'Apartment: Gäste',
	'Apartment: Name'             => 'Apartment: Name',
	'Apartment: Price from'       => 'Apartment: Preis ab',
	'Apartments'                  => 'Apartments',
	'Apartments Status'           => 'Apartment-Status',
	'Apply Filter'                => 'Filter anwenden',
	'Approve'                     => 'Bestätigen',
	'Approve %s'                  => '%s bestätigen',
	'Approve booking'             => 'Buchung bestätigen',
	'Arrival'                     => 'Anreise',
	'Arrival date and time'       => 'Anreisedatum und -uhrzeit',
	'Arrives'                     => 'Anreise',
	'Arriving in the next 7 days' => 'Anreise in den nächsten 7 Tagen',
	'At least one guest.'         => 'Mindestens ein Gast.',
	'At least one hour.'          => 'Mindestens eine Stunde.',
	'Attributes'                  => 'Attribute',
	'Availability'                => 'Verfügbarkeit',
	'Available start times'       => 'Verfügbare Startzeiten',
	'Available — you can continue.' => 'Verfügbar — Sie können fortfahren.',
	'Average Booking Duration'    => 'Durchschnittliche Buchungsdauer',
	'Average Booking Value'       => 'Durchschnittlicher Buchungswert',
	'Average Value'               => 'Durchschnittswert',
	'Avg Turnaround'              => 'Ø Wechselzeit',
	'Awaiting Payment'            => 'Zahlung ausstehend',
	'Back'                        => 'Zurück',
	'Back to bookings'            => 'Zurück zu den Buchungen',
	'Base URL'                    => 'Basis-URL',
	'Base — first %d hours'       => 'Grundpreis — erste %d Stunden',
	'Book now'                    => 'Jetzt buchen',
	'Book now button'             => '„Jetzt buchen“-Schaltfläche',
	'Book this apartment'         => 'Dieses Apartment buchen',
	'Bookable right now'          => 'Aktuell buchbar',
	'Booked'                      => 'Gebucht',
	'Booked more than once'       => 'Mehr als einmal gebucht',
	'Booked value'                => 'Gebuchter Wert',
	'Booked value, refunds excluded' => 'Gebuchter Wert, ohne Erstattungen',
	'Booking'                     => 'Buchung',
	'Booking Status Distribution' => 'Verteilung der Buchungsstatus',
	'Booking Suite'               => 'Booking Suite',
	'Booking Suite %s'            => 'Booking Suite %s',
	'Booking Suite: the admin interface has not been built yet.' => 'Booking Suite: Die Verwaltungsoberfläche wurde noch nicht erstellt.',
	'Booking activity'            => 'Buchungsaktivität',
	'Booking confirmed'           => 'Buchung bestätigt',
	'Booking details'             => 'Buchungsdetails',
	'Booking history, newest first.' => 'Buchungsverlauf, neueste zuerst.',
	'Booking not found.'          => 'Buchung nicht gefunden.',
	'Booking reference'           => 'Buchungsnummer',
	'Booking request received'    => 'Buchungsanfrage eingegangen',
	'Booking short link'          => 'Buchungs-Kurzlink',
	'Booking status'              => 'Buchungsstatus',
	'Booking total'               => 'Buchungssumme',
	'Booking total, with currency' => 'Buchungssumme, mit Währung',
	'Bookings'                    => 'Buchungen',
	'Bookings Trend'              => 'Buchungsverlauf',
	'Bookings across all customers' => 'Buchungen über alle Kunden',
	'Bookings are priced and invoiced in this currency.' => 'Buchungen werden in dieser Währung berechnet und abgerechnet.',
	'Bookings taken in each period.' => 'Buchungen je Zeitraum.',
	'Bookings today'              => 'Buchungen heute',
	'Buttons, selected times and focus rings on the booking flow.' => 'Schaltflächen, ausgewählte Zeiten und Fokusrahmen im Buchungsablauf.',
	'Button size.'                => 'Größe der Schaltfläche.',
	'Button text.'                => 'Beschriftung der Schaltfläche.',
	'By the hour'                 => 'Stundenweise',
	'Calculated'                  => 'Berechnet',
	'Calendar'                    => 'Kalender',
	'Calendar colour'             => 'Kalenderfarbe',
	'Cancel'                      => 'Abbrechen',
	'Cancellation Rate'           => 'Stornoquote',
	'Capacity & turnaround'       => 'Kapazität & Wechselzeit',
	'Catalogue'                   => 'Katalog',
	'Charges'                     => 'Positionen',
	'Check-in'                    => 'Anreise',
	'Check-in cannot be in the past.' => 'Die Anreise kann nicht in der Vergangenheit liegen.',
	'Check-ins this week'         => 'Anreisen diese Woche',
	'Check-out'                   => 'Abreise',
	'Check-out must be after check-in.' => 'Die Abreise muss nach der Anreise liegen.',
	'Checking availability…'      => 'Verfügbarkeit wird geprüft …',
	'Children'                    => 'Kinder',
	'Choose a date'               => 'Datum wählen',
	'Choose a date to see what is free.' => 'Wählen Sie ein Datum, um zu sehen, was frei ist.',
	'Choose an apartment.'        => 'Wählen Sie ein Apartment.',
	'Choose an image'             => 'Bild auswählen',
	'Choose at least one apartment to lock.' => 'Wählen Sie mindestens ein Apartment zum Sperren.',
	'Choose at least one apartment.' => 'Wählen Sie mindestens ein Apartment.',
	'Choose at least one extra to lock.' => 'Wählen Sie mindestens ein Extra zum Sperren.',
	'Choose when you are coming'  => 'Wählen Sie, wann Sie kommen',
	'Choose…'                     => 'Auswählen …',
	'City'                        => 'Stadt',
	'Cleaning'                    => 'Reinigung',
	'Cleaning Duration'           => 'Reinigungsdauer',
	'Cleaning time'               => 'Reinigungszeit',
	'Cleaning time must be one of: %s.' => 'Die Reinigungszeit muss einer dieser Werte sein: %s.',
	'Clear'                       => 'Zurücksetzen',
	'Clear Image'                 => 'Bild entfernen',
	'Clear date'                  => 'Datum zurücksetzen',
	'Clear search'                => 'Suche zurücksetzen',
	'Click or drop screenshot of payment here' => 'Screenshot der Zahlung hier ablegen oder klicken',
	'Close'                       => 'Schließen',
	'Closes every apartment for the window, including any added later.' => 'Sperrt alle Apartments für den Zeitraum, auch später hinzugefügte.',
	'Closes the apartments you choose for the window.' => 'Sperrt die ausgewählten Apartments für den Zeitraum.',
	'Color'                       => 'Farbe',
	'Combined'                    => 'Gesamt',
	'Comma-separated apartment IDs to show, in the order given. Defaults to every active apartment.' => 'Kommagetrennte Apartment-IDs in der angegebenen Reihenfolge. Standardmäßig alle aktiven Apartments.',
	'Completed'                   => 'Abgeschlossen',
	'Cancelled'                   => 'Storniert',
	'Comprehensive analytics and reports for your room booking business.' => 'Ausführliche Auswertungen und Berichte zu Ihren Buchungen.',
	'Confirm'                     => 'Bestätigen',
	'Confirmed'                   => 'Bestätigt',
	'Confirmed Stays'             => 'Bestätigte Aufenthalte',
	'Contact'                     => 'Kontakt',
	'Continue'                    => 'Weiter',
	'Copy'                        => 'Kopieren',
	'Copy to clipboard'           => 'In die Zwischenablage kopieren',
	'Could not build the report'  => 'Der Bericht konnte nicht erstellt werden',
	'Could not check'             => 'Konnte nicht geprüft werden',
	'Could not load bookings'     => 'Buchungen konnten nicht geladen werden',
	'Could not load customers'    => 'Kunden konnten nicht geladen werden',
	'Could not load the available times.' => 'Die verfügbaren Zeiten konnten nicht geladen werden.',
	'Could not load the calendar' => 'Der Kalender konnte nicht geladen werden',
	'Could not load the guide'    => 'Die Anleitung konnte nicht geladen werden',
	'Could not load the overview' => 'Die Übersicht konnte nicht geladen werden',
	'Could not reach the server.' => 'Der Server ist nicht erreichbar.',
	'Could not save settings'     => 'Einstellungen konnten nicht gespeichert werden',
	'Country'                     => 'Land',
	'Covering %1$s to %2$s.'      => 'Zeitraum %1$s bis %2$s.',
	'Currency'                    => 'Währung',
	'Custom Range'                => 'Eigener Zeitraum',
	'Customer'                    => 'Kunde',
	'Customer Analytics'          => 'Kundenauswertung',
	'Customers'                   => 'Kunden',
	'Customers appear here as soon as their first booking is taken.' => 'Kunden erscheinen hier, sobald ihre erste Buchung erfasst wurde.',
	'Daily'                       => 'Täglich',
	'Dashboard'                   => 'Dashboard',
	'Database'                    => 'Datenbank',
	'Date'                        => 'Datum',
	'Date Range'                  => 'Zeitraum',
	'Daytime'                     => 'Tagsüber',
	'Deactivate'                  => 'Deaktivieren',
	'Deactivate %s'               => '%s deaktivieren',
	'Default'                     => 'Standard',
	'Delete'                      => 'Löschen',
	'Delete %s'                   => '%s löschen',
	'Delete this apartment?'      => 'Dieses Apartment löschen?',
	'Delete this extra?'          => 'Dieses Extra löschen?',
	'Deleted apartment'           => 'Gelöschtes Apartment',
	'Deleting…'                   => 'Wird gelöscht …',
	'Departs'                     => 'Abreise',
	'Departure'                   => 'Abreise',
	'Departure date and time'     => 'Abreisedatum und -uhrzeit',
	'Describe the apartment…'     => 'Beschreiben Sie das Apartment …',
	'Description'                 => 'Beschreibung',
	'Details'                     => 'Details',
	'Details for %s'              => 'Details zu %s',
	'Discount'                    => 'Rabatt',
	'Distinct guests booking'     => 'Verschiedene buchende Gäste',
	'Done'                        => 'Fertig',
	'Drop any of these into a subject or message and the booking fills them in. Anything unrecognised is left alone.' => 'Setzen Sie diese Platzhalter in Betreff oder Text ein — die Buchung füllt sie aus. Unbekannte Platzhalter bleiben unverändert.',
	'Duration'                    => 'Dauer',
	'Duration the search bar starts on, in hours. Defaults to the shortest bookable length from Settings, and is limited to the range between the shortest and longest booking.' => 'Dauer, mit der die Suchleiste startet, in Stunden. Standardmäßig die kürzeste buchbare Dauer aus den Einstellungen; begrenzt auf den Bereich zwischen kürzester und längster Buchung.',
	'Edit'                        => 'Bearbeiten',
	'Edit %s'                     => '%s bearbeiten',
	'Edit Apartment'              => 'Apartment bearbeiten',
	'Edit Extra'                  => 'Extra bearbeiten',
	'Edit booking'                => 'Buchung bearbeiten',
	'Edited'                      => 'Bearbeitet',
	'Email'                       => 'E-Mail',
	'Email Templates'             => 'E-Mail-Vorlagen',
	'Enable stock management for this extra' => 'Bestandsverwaltung für dieses Extra aktivieren',
	'English (en)'                => 'Englisch (en)',
	'Enter a name.'               => 'Geben Sie einen Namen ein.',
	'Enter a price of 0 or more.' => 'Geben Sie einen Preis von 0 oder mehr ein.',
	'Enter a rate of 0 or more.'  => 'Geben Sie einen Preis von 0 oder mehr ein.',
	'Enter a valid email address.' => 'Geben Sie eine gültige E-Mail-Adresse ein.',
	'Enter how many guests fit.'  => 'Geben Sie an, wie viele Gäste Platz finden.',
	'Enter the available quantity.' => 'Geben Sie die verfügbare Menge ein.',
	'Enter the name of the extra item.' => 'Geben Sie den Namen des Extras ein.',
	'Euro (€)'                    => 'Euro (€)',
	'Every apartment is open for booking. Lock one for maintenance, or lock everything for a closure.' => 'Alle Apartments sind buchbar. Sperren Sie einzelne für Wartungsarbeiten oder alle für eine Schließung.',
	'Every path below hangs off this. Admin routes need a logged-in user with manage_options and the wp_rest nonce; public ones do not.' => 'Alle Pfade unten hängen daran. Admin-Routen erfordern einen angemeldeten Benutzer mit „manage_options“ und den wp_rest-Nonce; öffentliche nicht.',
	'Everyone who has booked'     => 'Alle, die gebucht haben',
	'Example'                     => 'Beispiel',
	'Extra'                       => 'Extra',
	'Extras'                      => 'Extras',
	'Extras are offered to guests during booking.' => 'Extras werden Gästen während der Buchung angeboten.',
	'Fields marked * are required.' => 'Mit * markierte Felder sind Pflichtfelder.',
	'Filter'                      => 'Filter',
	'Filter by path or method…'   => 'Nach Pfad oder Methode filtern …',
	'First name'                  => 'Vorname',
	'Follow Hesse public holidays' => 'Hessische Feiertage berücksichtigen',
	'Free'                        => 'Frei',
	'From'                        => 'Von',
	'General'                     => 'Allgemein',
	'German (de)'                 => 'Deutsch (de)',
	'Give a date, a start time and a length.' => 'Geben Sie Datum, Startzeit und Dauer an.',
	'Give a start and an end for the lock.' => 'Geben Sie Beginn und Ende der Sperre an.',
	'Give an arrival and a departure date.' => 'Geben Sie ein Anreise- und ein Abreisedatum an.',
	'Give the apartment a name.'  => 'Geben Sie dem Apartment einen Namen.',
	'Gross'                       => 'Brutto',
	'Group by'                    => 'Gruppieren nach',
	'Guest'                       => 'Gast',
	'Guest notes'                 => 'Anmerkungen des Gastes',
	'Guest paid on'               => 'Gast hat gezahlt am',
	'Guests'                      => 'Gäste',

	// The shortest booking a guest may make.
	'From %d hour.'               => array( 'Ab %d Stunde.', 'Ab %d Stunden.' ),
	'Bookings start at %d hour.'  => array(
		'Buchungen beginnen ab %d Stunde.',
		'Buchungen beginnen ab %d Stunden.',
	),

	// The party-size limit, and the panel shown when a day has nothing free.
	'Up to %d guest.'             => array( 'Bis zu %d Gast.', 'Bis zu %d Gäste.' ),
	'This apartment takes at most %d guest.' => array(
		'Diese Wohnung ist für höchstens %d Gast ausgelegt.',
		'Diese Wohnung ist für höchstens %d Gäste ausgelegt.',
	),
	'%1$s on %2$s'                => '%1$s am %2$s',
	'Nothing free on %s for this length.' => 'Am %s ist für diese Dauer nichts frei.',
	'Next free day — %s'          => 'Nächster freier Tag — %s',
	'This is a different day to the one you picked. Choosing a time moves your booking to it.' => 'Das ist ein anderer Tag als der von Ihnen gewählte. Wenn Sie eine Uhrzeit wählen, wird Ihre Buchung auf diesen Tag verschoben.',
	'Another apartment that is free' => array(
		'Eine andere Wohnung ist frei',
		'Andere Wohnungen sind frei',
	),
	'Try a shorter booking, a smaller party, or a date further ahead.' => 'Versuchen Sie es mit einer kürzeren Buchung, weniger Gästen oder einem späteren Datum.',
	'Guests must be between 1 and 65535.' => 'Die Gästezahl muss zwischen 1 und 65535 liegen.',
	'HTML'                        => 'HTML',
	'Hesse public holidays are treated as blocked days for this apartment.' => 'Hessische Feiertage gelten für dieses Apartment als gesperrte Tage.',
	'Hours'                       => 'Stunden',
	'How long?'                   => 'Wie lange?',
	'How many guests fit, and how long the apartment is blocked between stays.' => 'Wie viele Gäste Platz finden und wie lange das Apartment zwischen zwei Aufenthalten gesperrt bleibt.',
	'How prices and the guest-facing booking flow are presented.' => 'Wie Preise und der Buchungsablauf für Gäste dargestellt werden.',
	'How the apartments are sorted.' => 'Wie die Apartments sortiert werden.',
	'How the window splits across the booking lifecycle.' => 'Wie sich der Zeitraum über die Buchungsphasen verteilt.',
	'How this apartment is identified across the calendar and the website.' => 'Wie dieses Apartment im Kalender und auf der Website erkennbar ist.',
	'Image URL'                   => 'Bild-URL',
	'In house'                    => 'Im Haus',
	'Inactive'                    => 'Inaktiv',
	'Inactive apartments stay in the list but cannot be booked.' => 'Inaktive Apartments bleiben in der Liste, sind aber nicht buchbar.',
	'Infants'                     => 'Kleinkinder',
	'Internal short link'         => 'Interner Kurzlink',
	'Invoice'                     => 'Rechnung',
	'Items offered at booking'    => 'Beim Buchen angebotene Positionen',
	'Kept for your own reference — maintenance, a private stay, a deep clean.' => 'Nur für Ihre eigene Übersicht — Wartung, Eigennutzung, Grundreinigung.',
	'Language'                    => 'Sprache',
	'Last 30 Days'                => 'Letzte 30 Tage',
	'Last 7 Days'                 => 'Letzte 7 Tage',
	'Last Month'                  => 'Letzter Monat',
	'Last name'                   => 'Nachname',
	'Last stay'                   => 'Letzter Aufenthalt',
	'Leave empty to use the calculated rate.' => 'Leer lassen, um den berechneten Preis zu verwenden.',
	'Lifetime spend per customer' => 'Gesamtumsatz je Kunde',
	'Lifetime value'              => 'Gesamtwert',
	'Link the apartment name to its own page.' => 'Den Apartment-Namen mit seiner eigenen Seite verlinken.',
	'Loading…'                    => 'Wird geladen …',
	'Lock'                        => 'Sperren',
	'Lock Apartment'              => 'Apartment sperren',
	'Lock Extra'                  => 'Extra sperren',
	'Lock saved'                  => 'Sperre gespeichert',
	'Locked'                      => 'Gesperrt',
	'Locked in and ready'         => 'Fest gebucht und bereit',
	'Locked until %s'             => 'Gesperrt bis %s',
	'Locking…'                    => 'Wird gesperrt …',
	'Locks'                       => 'Sperren',
	'Lower numbers appear first. Leave 0 for automatic ordering.' => 'Kleinere Zahlen erscheinen zuerst. 0 bedeutet automatische Sortierung.',
	'Manage apartments'           => 'Apartments verwalten',
	'Mark %s as paid'             => '%s als bezahlt markieren',
	'Mark as paid'                => 'Als bezahlt markieren',
	'Mark completed'              => 'Als abgeschlossen markieren',
	'Mark failed'                 => 'Als fehlgeschlagen markieren',
	'Mark payment for %s as paid' => 'Zahlung für %s als bezahlt markieren',
	'Mark refunded'               => 'Als erstattet markieren',
	'Master Lock'                 => 'Gesamtsperre',
	'Master lock'                 => 'Gesamtsperre',
	'Master lock — every apartment' => 'Gesamtsperre — alle Apartments',
	'Master locked'               => 'Gesamtsperre aktiv',
	'Max Guest Capacity'          => 'Maximale Gästezahl',
	'Maximum number of apartments to show. 0 shows them all.' => 'Höchstzahl der angezeigten Apartments. 0 zeigt alle.',
	'Measured on refunded bookings — this system has no cancelled status.' => 'Gemessen an erstatteten Buchungen — dieses System kennt keinen Status „storniert“.',
	'Message'                     => 'Nachricht',
	'Method'                      => 'Zahlungsart',
	'Minimum %d hour'             => array( 'Mindestens %d Stunde', 'Mindestens %d Stunden' ),
	'Monthly'                     => 'Monatlich',
	'Name'                        => 'Name',
	'Name, email, phone or city…' => 'Name, E-Mail, Telefon oder Stadt …',
	'Needs action'                => 'Aktion erforderlich',
	'Needs restock'               => 'Bestand auffüllen',
	'New Apartment'               => 'Neues Apartment',
	'Next'                        => 'Weiter',
	'Next %s'                     => 'Nächste: %s',
	'Next month'                  => 'Nächster Monat',
	'Next photo'                  => 'Nächstes Foto',
	'Nights'                      => 'Nächte',
	'No apartment sleeps %d guest. Try a smaller party.' => array( 'Kein Apartment bietet Platz für %d Gast. Versuchen Sie es mit einer kleineren Gruppe.', 'Kein Apartment bietet Platz für %d Gäste. Versuchen Sie es mit einer kleineren Gruppe.' ),
	'No apartments are available just now.' => 'Zurzeit sind keine Apartments verfügbar.',
	'No apartments found.'        => 'Keine Apartments gefunden.',
	'No apartments match your search' => 'Keine Apartments passen zu Ihrer Suche',
	'No apartments match your search.' => 'Keine Apartments passen zu Ihrer Suche.',
	'No apartments yet'           => 'Noch keine Apartments',
	'No apartments yet.'          => 'Noch keine Apartments.',
	'No booking requests yet'     => 'Noch keine Buchungsanfragen',
	'No booking touches this date for the apartments currently shown.' => 'Für die aktuell angezeigten Apartments gibt es an diesem Datum keine Buchung.',
	'No bookings in this window.' => 'Keine Buchungen in diesem Zeitraum.',
	'No bookings match your filter' => 'Keine Buchungen passen zu Ihrem Filter',
	'No customers match your search' => 'Keine Kunden passen zu Ihrer Suche',
	'No customers yet'            => 'Noch keine Kunden',
	'No data yet'                 => 'Noch keine Daten',
	'No extras are offered with this apartment.' => 'Zu diesem Apartment werden keine Extras angeboten.',
	'No extras match your search' => 'Keine Extras passen zu Ihrer Suche',
	'No extras were booked. The total is accommodation and any guest charge.' => 'Es wurden keine Extras gebucht. Die Summe umfasst die Unterkunft und etwaige Gästezuschläge.',
	'No extras yet'               => 'Noch keine Extras',
	'No extras yet.'              => 'Noch keine Extras.',
	'No name given'               => 'Kein Name angegeben',
	'No payments match your filters' => 'Keine Zahlungen passen zu Ihren Filtern',
	'No payments yet'             => 'Noch keine Zahlungen',
	'Not available for these dates' => 'Für diesen Zeitraum nicht verfügbar',
	'Not yet'                     => 'Noch nicht',
	'Notes'                       => 'Anmerkungen',
	'Nothing booked'              => 'Nichts gebucht',
	'Nothing booked ahead'        => 'Keine kommenden Buchungen',
	'Nothing free that day for this length. Try another date or a shorter booking.' => 'An diesem Tag ist für diese Dauer nichts frei. Versuchen Sie ein anderes Datum oder eine kürzere Buchung.',
	'Nothing locked'              => 'Nichts gesperrt',
	'Nothing to change.'          => 'Nichts zu ändern.',
	'Nothing to report yet'       => 'Noch nichts auszuwerten',
	'Number of guests'            => 'Anzahl der Gäste',
	'Occupancy'                   => 'Belegung',
	'Occupancy Rate'              => 'Auslastung',
	'Occupied'                    => 'Belegt',
	'Of the hours available'      => 'Von den verfügbaren Stunden',
	'Off'                         => 'Aus',
	'On'                          => 'An',
	'One fewer: %s'               => 'Einer weniger: %s',
	'One hour less'               => 'Eine Stunde weniger',
	'One hour more'               => 'Eine Stunde mehr',
	'One more: %s'                => 'Einer mehr: %s',
	'Only %d left for these dates' => array( 'Nur noch %d für diesen Zeitraum', 'Nur noch %d für diesen Zeitraum' ),
	'Only show apartments that sleep at least this many guests.' => 'Nur Apartments zeigen, die mindestens so vielen Gästen Platz bieten.',
	'Open in a new tab'           => 'In neuem Tab öffnen',
	'Open the booking window on an hourly visit of this length. Takes precedence over nights.' => 'Öffnet das Buchungsfenster für einen stundenweisen Besuch dieser Dauer. Hat Vorrang vor Nächten.',
	'Open the booking window on an overnight stay of this many nights.' => 'Öffnet das Buchungsfenster für einen Übernachtungsaufenthalt mit dieser Anzahl Nächte.',
	'Open the booking window on this date, as YYYY-MM-DD, instead of on today.' => 'Öffnet das Buchungsfenster an diesem Datum im Format JJJJ-MM-TT statt am heutigen Tag.',
	'Open uploaded receipt'       => 'Hochgeladenen Beleg öffnen',
	'Optimized'                   => 'Optimiert',
	'Optional description of the extra item.' => 'Optionale Beschreibung des Extras.',
	'Optional heading rendered above the grid.' => 'Optionale Überschrift über dem Raster.',
	'Optional heading rendered above the list.' => 'Optionale Überschrift über der Liste.',
	'Optional image for this extra item.' => 'Optionales Bild für dieses Extra.',
	'Optional line of text below the heading.' => 'Optionale Textzeile unter der Überschrift.',
	'Optional shortcuts to this apartment. Each must be unique across all apartments.' => 'Optionale Kurzlinks zu diesem Apartment. Jeder muss über alle Apartments hinweg eindeutig sein.',
	'Ordered by revenue in this window.' => 'Sortiert nach Umsatz in diesem Zeitraum.',
	'Out of Stock'                => 'Nicht auf Lager',
	'Out of stock'                => 'Nicht auf Lager',
	'Outstanding'                 => 'Offen',
	'Overnight'                   => 'Übernachtung',
	'Overnight stay (%s)'         => 'Übernachtung (%s)',
	'Overnight stays run %s and always take priority over hourly bookings.' => 'Übernachtungen laufen %s und haben immer Vorrang vor stundenweisen Buchungen.',
	'PNG, JPG, JPEG'              => 'PNG, JPG, JPEG',
	'Paid, net of refunds'        => 'Bezahlt, abzüglich Erstattungen',
	'Parameters'                  => 'Parameter',
	'Partly offline'              => 'Teilweise offline',
	'Path'                        => 'Pfad',
	'Payment'                     => 'Zahlung',
	'Payment Date'                => 'Zahlungsdatum',
	'Payment method'              => 'Zahlungsart',
	'Payment proof'               => 'Zahlungsnachweis',
	'Payment proof for %s'        => 'Zahlungsnachweis für %s',
	'Payment receipt'             => 'Zahlungsbeleg',
	'Payment receipt screenshot uploaded' => 'Screenshot des Zahlungsbelegs hochgeladen',
	'Payment receipt uploaded'    => 'Zahlungsbeleg hochgeladen',
	'Payment receipt uploaded by the guest' => 'Vom Gast hochgeladener Zahlungsbeleg',
	'Payment received'            => 'Zahlung erhalten',
	'Payment received — {{reference}}' => 'Zahlung erhalten — {{reference}}',
	'Payment status'              => 'Zahlungsstatus',
	'Payments'                    => 'Zahlungen',
	'Payments appear here as bookings are taken through the site.' => 'Zahlungen erscheinen hier, sobald Buchungen über die Website eingehen.',
	'Peak Booking Hours'          => 'Stärkste Buchungszeiten',
	'Pending'                     => 'Ausstehend',
	'Pending Requests'            => 'Offene Anfragen',
	'Pending bookings'            => 'Ausstehende Buchungen',
	'People'                      => 'Personen',
	'Percentage'                  => 'Prozent',
	'Phone'                       => 'Telefon',
	'Photo gallery'               => 'Fotogalerie',
	'Pick a check-in date.'       => 'Wählen Sie ein Anreisedatum.',
	'Pick a colour'               => 'Farbe wählen',
	'Pick a colour.'              => 'Wählen Sie eine Farbe.',
	'Pick a date.'                => 'Wählen Sie ein Datum.',
	'Pick a start date.'          => 'Wählen Sie ein Startdatum.',
	'Pick a start time.'          => 'Wählen Sie eine Startzeit.',
	'Pick an end date.'           => 'Wählen Sie ein Enddatum.',
	'Placeholders'                => 'Platzhalter',
	'Please choose a date.'       => 'Bitte wählen Sie ein Datum.',
	'Please choose a start time.' => 'Bitte wählen Sie eine Startzeit.',
	'Please choose both dates.'   => 'Bitte wählen Sie beide Daten.',
	'Please choose how long you need.' => 'Bitte wählen Sie, wie lange Sie bleiben möchten.',
	'Please give a valid email address.' => 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
	'Please give your first and last name.' => 'Bitte geben Sie Vor- und Nachnamen an.',
	'Postcode'                    => 'Postleitzahl',
	'Pound Sterling (£)'          => 'Britisches Pfund (£)',
	'Pre-fill the guest filter with a party size.' => 'Den Gästefilter mit einer Gruppengröße vorbelegen.',
	'Pre-fill the party size in the booking window.' => 'Die Gruppengröße im Buchungsfenster vorbelegen.',
	'Preferred column count on wide screens.' => 'Bevorzugte Spaltenanzahl auf breiten Bildschirmen.',
	'Previous month'              => 'Vorheriger Monat',
	'Previous photo'              => 'Vorheriges Foto',
	'Price'                       => 'Preis',
	'Price on request'            => 'Preis auf Anfrage',
	'Print Report'                => 'Bericht drucken',
	'Public'                      => 'Öffentlich',
	'Rates'                       => 'Preise',
	'Rates cannot be negative.'   => 'Preise dürfen nicht negativ sein.',
	'Reason'                      => 'Grund',
	'Receipt'                     => 'Beleg',
	'Received'                    => 'Erhalten',
	'Recorded'                    => 'Erfasst',
	'Recorded all time'           => 'Insgesamt erfasst',
	'Recurring Customers'         => 'Wiederkehrende Kunden',
	'Reference'                   => 'Buchungsnummer',
	'Reference, guest, email…'    => 'Buchungsnummer, Gast, E-Mail …',
	'Refresh'                     => 'Aktualisieren',
	'Refresh bookings list'       => 'Buchungsliste aktualisieren',
	'Refunded'                    => 'Erstattet',
	'Refunds excluded'            => 'Ohne Erstattungen',
	'Release'                     => 'Freigeben',
	'Release dates'               => 'Zeitraum freigeben',
	'Release this lock?'          => 'Diese Sperre aufheben?',
	'Remove'                      => 'Entfernen',
	'Remove one'                  => 'Eines entfernen',
	'Remove photo'                => 'Foto entfernen',
	'Repeat Customer Rate'        => 'Anteil wiederkehrender Kunden',
	'Reports & Analytics'         => 'Berichte & Auswertungen',
	'Request booking'             => 'Buchung anfragen',
	'Request failed.'             => 'Die Anfrage ist fehlgeschlagen.',
	'Request received'            => 'Anfrage eingegangen',
	'Requests made through the booking form on your site will appear here.' => 'Anfragen über das Buchungsformular Ihrer Website erscheinen hier.',
	'Reserve'                     => 'Reservieren',
	'Reserved'                    => 'Reserviert',
	'Reset'                       => 'Zurücksetzen',
	'Retry'                       => 'Erneut versuchen',
	'Revenue'                     => 'Umsatz',
	'Revenue Analysis'            => 'Umsatzanalyse',
	'Revenue per apartment across the window.' => 'Umsatz je Apartment im Zeitraum.',
	'Review'                      => 'Prüfen',
	'Room'                        => 'Zimmer',
	'Room Performance'            => 'Zimmerauswertung',
	'Save'                        => 'Speichern',
	'Save %s at this length'      => 'Bei dieser Dauer %s sparen',
	'Save Apartment'              => 'Apartment speichern',
	'Save Extra'                  => 'Extra speichern',
	'Save booking'                => 'Buchung speichern',
	'Save settings'               => 'Einstellungen speichern',
	'Saving…'                     => 'Wird gespeichert …',
	'Schema v%1$d, expected v%2$d' => 'Schema v%1$d, erwartet v%2$d',
	'Search'                      => 'Suchen',

	// The count under a paged list: "Showing 26–50 of 312".
	'Showing %1$d–%2$d of %3$d'   => '%1$d–%2$d von %3$d',
	'Search Apartments'           => 'Apartments suchen',
	'Search apartments'           => 'Apartments suchen',
	'Search bookings'             => 'Buchungen suchen',
	'Search by name…'             => 'Nach Namen suchen …',
	'Search customers'            => 'Kunden suchen',
	'Search endpoints'            => 'Endpunkte suchen',
	'Search extras'               => 'Extras suchen',
	'Search transactions'         => 'Transaktionen suchen',
	'Search transactions…'        => 'Transaktionen suchen …',
	'Searching for apartments…'   => 'Apartments werden gesucht …',
	'Send a test to'              => 'Test senden an',
	'Send test'                   => 'Test senden',
	'Send this booking back to pending? The dates become bookable again.' => 'Diese Buchung wieder auf „ausstehend“ setzen? Der Zeitraum wird dadurch wieder buchbar.',
	'Sending…'                    => 'Wird gesendet …',
	'Sent back to guests'         => 'An Gäste versendet',
	'Sent to the guest the moment they submit a booking request.' => 'Wird an den Gast gesendet, sobald er eine Buchungsanfrage abschickt.',
	'Sent when a payment is marked as paid, in the admin or on the payments screen.' => 'Wird gesendet, wenn eine Zahlung als bezahlt markiert wird — im Adminbereich oder auf der Zahlungsseite.',
	'Sent when a request is approved and the dates are held.' => 'Wird gesendet, wenn eine Anfrage bestätigt und der Zeitraum reserviert wird.',
	'Set up the apartment guests will see and book.' => 'Richten Sie das Apartment ein, das Gäste sehen und buchen.',
	'Settings'                    => 'Einstellungen',
	'Settings saved.'             => 'Einstellungen gespeichert.',
	'Settled'                     => 'Beglichen',
	'Short links'                 => 'Kurzlinks',
	'Shortcodes'                  => 'Shortcodes',
	'Show a two-line description under the name.' => 'Eine zweizeilige Beschreibung unter dem Namen anzeigen.',
	'Show all apartments'         => 'Alle Apartments anzeigen',
	'Show the date and guest search bar.' => 'Die Such­leiste für Datum und Gäste anzeigen.',
	'Show the nightly "from" price.' => 'Den „ab“-Preis pro Nacht anzeigen.',
	'Show the search bar: arrival date, duration and guests. Searching filters the grid by party size and opens the booking modal on the dates chosen.' => 'Die Suchleiste anzeigen: Anreisedatum, Dauer und Gäste. Die Suche filtert das Raster nach Gruppengröße und öffnet das Buchungsfenster mit dem gewählten Zeitraum.',
	'Shown to guests on the website.' => 'Wird Gästen auf der Website angezeigt.',
	'Some hidden'                 => 'Teilweise ausgeblendet',
	'Something went wrong'        => 'Etwas ist schiefgelaufen',
	'Something went wrong at our end. Please try again.' => 'Auf unserer Seite ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',
	'Sort'                        => 'Sortierung',
	'Sort Order'                  => 'Reihenfolge',
	'Sort direction.'             => 'Sortierrichtung.',
	'Source'                      => 'Quelle',
	'Start time'                  => 'Startzeit',
	'Status'                      => 'Status',
	'Status & price'              => 'Status & Preis',
	'Stay'                        => 'Aufenthalt',
	'Stay dates'                  => 'Aufenthaltszeitraum',
	'Stays'                       => 'Aufenthalte',
	'Stays are limited to %d nights.' => 'Aufenthalte sind auf %d Nächte begrenzt.',
	'Still to collect'            => 'Noch einzuziehen',
	'Stock'                       => 'Bestand',
	'Stock Quantity'              => 'Bestandsmenge',
	'Stock-managed and empty'     => 'Bestandsgeführt und leer',
	'Stretch to the width of its container.' => 'Auf die Breite des Containers strecken.',
	'Subject'                     => 'Betreff',
	'Supports JPG, PNG, WEBP or PDF receipt' => 'Unterstützt Belege als JPG, PNG, WEBP oder PDF',
	'Swiss Franc (CHF)'           => 'Schweizer Franken (CHF)',
	'System'                      => 'System',
	'Taken by phone, email or at the door.' => 'Telefonisch, per E-Mail oder vor Ort aufgenommen.',
	'Taken in the last 24 hours'  => 'In den letzten 24 Stunden erfasst',
	'Taken in this window'        => 'In diesem Zeitraum erfasst',
	'Taken per day, split by status.' => 'Pro Tag erfasst, nach Status aufgeteilt.',
	'Takes every extra off the board for the window. Extras added later are not covered.' => 'Nimmt alle Extras für den Zeitraum aus dem Angebot. Später hinzugefügte Extras sind nicht erfasst.',
	'Takes the extras you choose off the board for the window.' => 'Nimmt die ausgewählten Extras für den Zeitraum aus dem Angebot.',
	'Template restored to the original text.' => 'Vorlage auf den ursprünglichen Text zurückgesetzt.',
	'Template saved.'             => 'Vorlage gespeichert.',
	'Test email sent.'            => 'Test-E-Mail gesendet.',
	'Text'                        => 'Text',
	'Text of the booking button on each card.' => 'Beschriftung der Buchungsschaltfläche auf jeder Karte.',
	'Thank you — your booking request has been received. We will confirm it by email with payment details.' => 'Vielen Dank — Ihre Buchungsanfrage ist eingegangen. Wir bestätigen sie per E-Mail zusammen mit den Zahlungsdaten.',
	'That email template does not exist.' => 'Diese E-Mail-Vorlage existiert nicht.',
	'That extra no longer exists.' => 'Dieses Extra existiert nicht mehr.',
	'That guest no longer exists.' => 'Dieser Gast existiert nicht mehr.',
	'That lock no longer exists.' => 'Diese Sperre existiert nicht mehr.',
	'That payment no longer exists.' => 'Diese Zahlung existiert nicht mehr.',
	'That short link is already used by another apartment.' => 'Dieser Kurzlink wird bereits von einem anderen Apartment verwendet.',
	'That time has already passed.' => 'Dieser Zeitpunkt liegt bereits in der Vergangenheit.',
	'The apartment could not be deleted.' => 'Das Apartment konnte nicht gelöscht werden.',
	'The apartment could not be saved.' => 'Das Apartment konnte nicht gespeichert werden.',
	'The apartment could not be updated.' => 'Das Apartment konnte nicht aktualisiert werden.',
	'The apartments could not be loaded.' => 'Die Apartments konnten nicht geladen werden.',
	'The brand colour of the guest booking flow. Hover, pressed and tint shades are worked out from it, so one colour is all that is needed.' => 'Die Markenfarbe des Buchungsablaufs für Gäste. Hover-, Klick- und Tönungsabstufungen werden daraus berechnet — eine Farbe genügt.',
	'The booking could not be saved.' => 'Die Buchung konnte nicht gespeichert werden.',
	'The booking could not be updated.' => 'Die Buchung konnte nicht aktualisiert werden.',
	'The colour must be a hex value such as #3858e9.' => 'Die Farbe muss ein Hex-Wert wie #3858e9 sein.',
	'The extra could not be saved.' => 'Das Extra konnte nicht gespeichert werden.',
	'The extra needs a name.'     => 'Das Extra braucht einen Namen.',
	'The first photo is also used as the featured image.' => 'Das erste Foto wird auch als Beitragsbild verwendet.',
	'The guest has not uploaded a receipt.' => 'Der Gast hat keinen Beleg hochgeladen.',
	'The guest-facing apartment grid, with an optional date and guest search bar above it.' => 'Das Apartment-Raster für Gäste, wahlweise mit einer Suchleiste für Datum und Gäste darüber.',
	'The language the booking flow is shown in.' => 'Die Sprache, in der der Buchungsablauf angezeigt wird.',
	'The lock could not be saved.' => 'Die Sperre konnte nicht gespeichert werden.',
	'The lock must end after it starts.' => 'Die Sperre muss nach ihrem Beginn enden.',
	'The price cannot be negative.' => 'Der Preis darf nicht negativ sein.',
	'The same value as the post title — changing it here renames the apartment everywhere.' => 'Derselbe Wert wie der Beitragstitel — eine Änderung hier benennt das Apartment überall um.',
	'The stock quantity cannot be negative.' => 'Die Bestandsmenge darf nicht negativ sein.',
	'Their first name only'       => 'Nur der Vorname',
	'There are no bookings yet, so there is nothing to fill the placeholders with.' => 'Es gibt noch keine Buchungen, daher lassen sich die Platzhalter nicht füllen.',
	'These bookings already sit inside it. The lock stops new bookings; it has not touched them.' => 'Diese Buchungen liegen bereits darin. Die Sperre verhindert neue Buchungen; an bestehenden ändert sie nichts.',
	'This Month'                  => 'Dieser Monat',
	'This Year'                   => 'Dieses Jahr',
	'This apartment cannot be booked.' => 'Dieses Apartment kann nicht gebucht werden.',
	'This apartment sleeps up to %d guest.' => array( 'Dieses Apartment bietet Platz für bis zu %d Gast.', 'Dieses Apartment bietet Platz für bis zu %d Gäste.' ),
	'This customer has no bookings yet.' => 'Dieser Kunde hat noch keine Buchungen.',
	'Those dates are already taken. Please try another window.' => 'Dieser Zeitraum ist bereits vergeben. Bitte wählen Sie einen anderen.',
	'Those dates go back on the board and can be booked again.' => 'Dieser Zeitraum wird wieder freigegeben und ist erneut buchbar.',
	'Those dates have just been taken. Please choose another window.' => 'Dieser Zeitraum wurde soeben vergeben. Bitte wählen Sie einen anderen.',
	'Time Slot'                   => 'Zeitfenster',
	'To'                          => 'Bis',
	'To collect'                  => 'Einzuziehen',
	'Today'                       => 'Heute',
	'Today, %s'                   => 'Heute, %s',
	'Top Performing Rooms'        => 'Beste Zimmer',
	'Total'                       => 'Gesamt',
	'Total Bookings'              => 'Buchungen gesamt',
	'Total Capacity'              => 'Gesamtkapazität',
	'Total Extras'                => 'Extras gesamt',
	'Total Properties'            => 'Objekte gesamt',
	'Total Revenue'               => 'Gesamtumsatz',
	'Total Stays'                 => 'Aufenthalte gesamt',
	'Total Value'                 => 'Gesamtwert',
	'Total amount'                => 'Gesamtbetrag',
	'Total available quantity for this extra (e.g. 3 for 3 projectors).' => 'Insgesamt verfügbare Menge dieses Extras (z. B. 3 für 3 Beamer).',
	'Total override'              => 'Gesamtbetrag überschreiben',
	'Transactions'                => 'Transaktionen',
	'Try a different name, email or city.' => 'Versuchen Sie einen anderen Namen, eine andere E-Mail oder Stadt.',
	'Try a different name, or clear the search to see all apartments.' => 'Versuchen Sie einen anderen Namen oder setzen Sie die Suche zurück, um alle Apartments zu sehen.',
	'Try a different name, or clear the search to see all extras.' => 'Versuchen Sie einen anderen Namen oder setzen Sie die Suche zurück, um alle Extras zu sehen.',
	'Try a smaller party size, or different dates.' => 'Versuchen Sie eine kleinere Gruppe oder andere Daten.',
	'Try a wider date range, or clear the filters to see everything.' => 'Versuchen Sie einen größeren Zeitraum oder setzen Sie die Filter zurück, um alles zu sehen.',
	'Try again'                   => 'Erneut versuchen',
	'Try another status, or clear the search to see all requests.' => 'Versuchen Sie einen anderen Status oder setzen Sie die Suche zurück, um alle Anfragen zu sehen.',
	'Turnaround blocked after each stay.' => 'Nach jedem Aufenthalt gesperrte Wechselzeit.',
	'Type'                        => 'Typ',
	'US Dollar ($)'               => 'US-Dollar ($)',
	'Under 2, not counted towards occupancy' => 'Unter 2 Jahren, zählt nicht zur Belegung',
	'Unique Customers'            => 'Einzelne Kunden',
	'Units Booked'                => 'Gebuchte Einheiten',
	'Units Registered'            => 'Erfasste Einheiten',
	'Unknown Booking Suite screen.' => 'Unbekannte Booking-Suite-Seite.',
	'Unlimited'                   => 'Unbegrenzt',
	'Unpaid and part-paid bookings' => 'Unbezahlte und teilbezahlte Buchungen',
	'Until %s'                    => 'Bis %s',
	'Up to %d guest'              => array( 'Bis zu %d Gast', 'Bis zu %d Gäste' ),
	'Upcoming'                    => 'Bevorstehend',
	'Upload Image'                => 'Bild hochladen',
	'Upload Payment Screenshot / Receipt' => 'Zahlungs-Screenshot / Beleg hochladen',
	'Upload image'                => 'Bild hochladen',
	'Upload payment proof'        => 'Zahlungsnachweis hochladen',
	'Uploaded successfully'       => 'Erfolgreich hochgeladen',
	'Use these photos'            => 'Diese Fotos verwenden',
	'Use this image'              => 'Dieses Bild verwenden',
	'Use this logo'             => 'Dieses Logo verwenden',
	'User Guide'                  => 'Anleitung',
	'Usually sleeps %d — we will confirm the extra beds with you.' => 'Normalerweise Platz für %d — die zusätzlichen Betten stimmen wir mit Ihnen ab.',
	'Value of the bookings taken each day.' => 'Wert der täglich erfassten Buchungen.',
	'Value of the bookings taken, refunds excluded.' => 'Wert der erfassten Buchungen, ohne Erstattungen.',
	'View Apartment'              => 'Apartment ansehen',
	'View Calendar'               => 'Kalender ansehen',
	'View all bookings for %s'    => 'Alle Buchungen von %s ansehen',
	'View details'                => 'Details ansehen',
	'View payment'                => 'Zahlung ansehen',
	'Visible to customers'        => 'Für Kunden sichtbar',
	'Visual weight of the button.' => 'Optische Gewichtung der Schaltfläche.',
	'Waiting on confirmation'     => 'Wartet auf Bestätigung',
	'We have your request — {{reference}}' => 'Ihre Anfrage ist eingegangen — {{reference}}',
	'We will email you a confirmation with the bank transfer details. Nothing is charged online.' => 'Wir senden Ihnen eine Bestätigung mit den Überweisungsdaten per E-Mail. Online wird nichts abgebucht.',
	'Weekday rate (Sun–Thu)'      => 'Wochentagspreis (So–Do)',
	'Weekend rate (Fri/Sat)'      => 'Wochenendpreis (Fr/Sa)',
	'Surcharges'                  => 'Zuschläge',
	'What this apartment adds beyond the base rate. Both were once one figure for the whole site, which made a studio and a villa charge the same for a fifth guest.' => 'Was diese Wohnung zusätzlich zum Grundpreis berechnet. Beide Werte galten früher für die gesamte Website — ein Studio und eine Villa berechneten damit denselben Betrag für einen fünften Gast.',
	'Per extra hour'              => 'Pro zusätzlicher Stunde',
	'Charged for each hour beyond the base the rate covers.' => 'Wird für jede Stunde berechnet, die über die im Grundpreis enthaltenen hinausgeht.',
	'Per extra guest'             => 'Pro zusätzlichem Gast',
	'Charged for each guest beyond the party size the rate covers.' => 'Wird für jeden Gast berechnet, der über die im Grundpreis enthaltene Personenzahl hinausgeht.',
	'Weekly'                      => 'Wöchentlich',
	'When'                        => 'Wann',
	'When enabled, you can set a limited quantity. When disabled, unlimited quantity is available.' => 'Wenn aktiviert, können Sie eine begrenzte Menge festlegen. Wenn deaktiviert, ist die Menge unbegrenzt.',
	'When stays start, busiest first.' => 'Wann Aufenthalte beginnen, die stärksten zuerst.',
	'Where each one stands right now.' => 'Wie es um jedes einzelne gerade steht.',
	'Who is coming'               => 'Wer kommt',
	'WordPress could not send the email. Check the template is switched on and that the site can send mail.' => 'WordPress konnte die E-Mail nicht senden. Prüfen Sie, ob die Vorlage aktiviert ist und die Website E-Mails versenden kann.',
	'Working out the price…'      => 'Preis wird berechnet …',
	'Your booking is confirmed — {{reference}}' => 'Ihre Buchung ist bestätigt — {{reference}}',
	'Your booking will be verified once your payment proof is confirmed.' => 'Ihre Buchung wird bestätigt, sobald Ihr Zahlungsnachweis geprüft wurde.',
	'Your session expired. Reload the page and try again.' => 'Ihre Sitzung ist abgelaufen. Laden Sie die Seite neu und versuchen Sie es erneut.',
	'Your site address'           => 'Die Adresse Ihrer Website',
	'Your site name'              => 'Der Name Ihrer Website',
	'e.g. Studio Rheinblick'      => 'z. B. Studio Rheinblick',
	'from'                        => 'ab',
	'holiday'                     => 'Feiertag',
	'no SMTP plugin'              => 'kein SMTP-Plugin',
	'save %s'                     => '%s sparen',
	'until %s'                    => 'bis %s',
	'weekend'                     => 'Wochenende',
	'you@example.com'             => 'sie@beispiel.de',
	'Zusätzliche Person — %1$s je Person (%2$d im Preis enthalten)' => 'Zusätzliche Person — %1$s je Person (%2$d im Preis enthalten)',
	'Zusätzliche Person'       => 'Zusätzliche Person',
	'— %s'                        => '— %s',

	// Counts and formatted fragments.

	// Shortcode documentation.

	// Email templates. The {{tokens}} must not be translated.
	'Hello {{guest_first_name}},

Good news — your booking is confirmed and the dates are yours.

Reference: {{reference}}
Apartment: {{apartment}}
Arrival: {{check_in}}
Departure: {{check_out}}
Guests: {{guests}}
Total: {{total}}

Please transfer the total using the reference above. We will confirm as soon as it arrives.

We look forward to having you.

{{site_name}}
{{site_url}}' => 'Hallo {{guest_first_name}},

gute Nachrichten — Ihre Buchung ist bestätigt und der Zeitraum gehört Ihnen.

Buchungsnummer: {{reference}}
Apartment: {{apartment}}
Anreise: {{check_in}}
Abreise: {{check_out}}
Gäste: {{guests}}
Gesamt: {{total}}

Bitte überweisen Sie den Gesamtbetrag unter Angabe der obigen Buchungsnummer. Wir bestätigen den Eingang, sobald die Zahlung bei uns ist.

Wir freuen uns auf Ihren Besuch.

{{site_name}}
{{site_url}}',

	'Hello {{guest_first_name}},

Thank you for your request. We have it, and we will confirm it shortly.

Reference: {{reference}}
Apartment: {{apartment}}
Arrival: {{check_in}}
Departure: {{check_out}}
Guests: {{guests}}
Total: {{total}}

Nothing is due yet — we will send payment details once the booking is confirmed.

{{site_name}}
{{site_url}}' => 'Hallo {{guest_first_name}},

vielen Dank für Ihre Anfrage. Sie ist bei uns eingegangen und wir bestätigen sie in Kürze.

Buchungsnummer: {{reference}}
Apartment: {{apartment}}
Anreise: {{check_in}}
Abreise: {{check_out}}
Gäste: {{guests}}
Gesamt: {{total}}

Es ist noch nichts fällig — die Zahlungsdaten senden wir Ihnen, sobald die Buchung bestätigt ist.

{{site_name}}
{{site_url}}',

	'Hello {{guest_first_name}},

We have received your payment of {{total}}. Your stay is fully settled.

Reference: {{reference}}
Apartment: {{apartment}}
Arrival: {{check_in}}
Departure: {{check_out}}

Safe travels, and see you soon.

{{site_name}}
{{site_url}}' => 'Hallo {{guest_first_name}},

wir haben Ihre Zahlung über {{total}} erhalten. Ihr Aufenthalt ist vollständig bezahlt.

Buchungsnummer: {{reference}}
Apartment: {{apartment}}
Anreise: {{check_in}}
Abreise: {{check_out}}

Gute Reise und bis bald.

{{site_name}}
{{site_url}}',

	"The guest's full name"       => 'Der vollständige Name des Gastes',
	'<h1>We have your request</h1>
<p>Hello {{guest_first_name}},</p>
<p>Thank you for your request. We have it, and we will confirm it shortly.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>Guests</th><td>{{guests}}</td></tr>
<tr><th>Total</th><td>{{total}}</td></tr>
</table>
<p>Nothing is due yet — we will send payment details once the booking is confirmed.</p>
<p>{{site_name}}</p>' => '<h1>Wir haben Ihre Anfrage</h1>
<p>Hallo {{guest_first_name}},</p>
<p>vielen Dank für Ihre Anfrage. Sie liegt uns vor, und wir bestätigen sie in Kürze.</p>
<table>
<tr><th>Buchungsnummer</th><td>{{reference}}</td></tr>
<tr><th>Wohnung</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Gäste</th><td>{{guests}}</td></tr>
<tr><th>Gesamt</th><td>{{total}}</td></tr>
</table>
<p>Es ist noch nichts fällig — die Zahlungsdaten senden wir Ihnen, sobald die Buchung bestätigt ist.</p>
<p>{{site_name}}</p>',
	'<h1>Your booking is confirmed</h1>
<p>Hello {{guest_first_name}},</p>
<p>Good news — your booking is confirmed and the dates are yours.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>Guests</th><td>{{guests}}</td></tr>
<tr><th>Total</th><td>{{total}}</td></tr>
</table>
<blockquote>Please transfer the total using the reference above. We will confirm as soon as it arrives.</blockquote>
<p>We look forward to having you.</p>
<p>{{site_name}}</p>' => '<h1>Ihre Buchung ist bestätigt</h1>
<p>Hallo {{guest_first_name}},</p>
<p>gute Nachrichten — Ihre Buchung ist bestätigt und die Termine gehören Ihnen.</p>
<table>
<tr><th>Buchungsnummer</th><td>{{reference}}</td></tr>
<tr><th>Wohnung</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Gäste</th><td>{{guests}}</td></tr>
<tr><th>Gesamt</th><td>{{total}}</td></tr>
</table>
<blockquote>Bitte überweisen Sie den Gesamtbetrag unter Angabe der obigen Buchungsnummer. Wir bestätigen den Eingang umgehend.</blockquote>
<p>Wir freuen uns auf Sie.</p>
<p>{{site_name}}</p>',
	'<h1>Payment received</h1>
<p>Hello {{guest_first_name}},</p>
<p>We have received your payment of <strong>{{total}}</strong>. Your stay is fully settled.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
</table>
<p>Your invoice is attached to this email.</p>
<p>Safe travels, and see you soon.</p>
<p>{{site_name}}</p>' => '<h1>Zahlung erhalten</h1>
<p>Hallo {{guest_first_name}},</p>
<p>wir haben Ihre Zahlung über <strong>{{total}}</strong> erhalten. Ihr Aufenthalt ist vollständig bezahlt.</p>
<table>
<tr><th>Buchungsnummer</th><td>{{reference}}</td></tr>
<tr><th>Wohnung</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
</table>
<p>Ihre Rechnung finden Sie im Anhang dieser E-Mail.</p>
<p>Gute Reise und bis bald.</p>
<p>{{site_name}}</p>',
	'<h1>Your booking has changed</h1>
<p>Hello {{guest_first_name}},</p>
<p>Your booking has been updated, and there is a balance still to pay. The new invoice is attached.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>New total</th><td>{{total}}</td></tr>
<tr><th>Already paid</th><td>{{amount_paid}}</td></tr>
<tr><th>Still to pay</th><td>{{amount_due}}</td></tr>
</table>
<blockquote>Please transfer <strong>{{amount_due}}</strong> using the reference above.</blockquote>
<p>{{site_name}}</p>' => '<h1>Ihre Buchung wurde geändert</h1>
<p>Hallo {{guest_first_name}},</p>
<p>Ihre Buchung wurde aktualisiert, und es steht noch ein Betrag offen. Die neue Rechnung finden Sie im Anhang.</p>
<table>
<tr><th>Buchungsnummer</th><td>{{reference}}</td></tr>
<tr><th>Wohnung</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Neuer Gesamtbetrag</th><td>{{total}}</td></tr>
<tr><th>Bereits bezahlt</th><td>{{amount_paid}}</td></tr>
<tr><th>Noch zu zahlen</th><td>{{amount_due}}</td></tr>
</table>
<blockquote>Bitte überweisen Sie <strong>{{amount_due}}</strong> unter Angabe der obigen Buchungsnummer.</blockquote>
<p>{{site_name}}</p>',
	'Updated invoice — {{reference}}' => 'Aktualisierte Rechnung — {{reference}}',
	'Balance due' => 'Offener Betrag',
	'Sent when a booking is changed after it was invoiced and there is more to pay — a guest extending their stay, for instance.' => 'Wird gesendet, wenn eine bereits berechnete Buchung geändert wird und noch ein Betrag offen ist — etwa wenn ein Gast seinen Aufenthalt verlängert.',
	'Balance after the booking was changed.' => 'Restbetrag nach Änderung der Buchung.',
	'Settled so far, with currency' => 'Bisher bezahlt, mit Währung',
	'Still to pay, with currency' => 'Noch zu zahlen, mit Währung',
	'Invoice number, once one is issued' => 'Rechnungsnummer, sobald eine vergeben ist',
	'Agreed total' => 'Vereinbarter Gesamtbetrag',
	'Calculate automatically' => 'Automatisch berechnen',
	'Set the price myself' => 'Preis selbst festlegen',
	'How the price is set' => 'Wie der Preis bestimmt wird',
	'Enter the agreed total.' => 'Geben Sie den vereinbarten Gesamtbetrag ein.',
	'What the guest is charged, whatever the rates would give.' => 'Was dem Gast berechnet wird, unabhängig von den Tarifen.',
	'Price breakdown' => 'Preisaufstellung',
	'Calculated price: %s' => 'Berechneter Preis: %s',
	'Base rate — first %d h' => 'Grundpreis — erste %d Std.',
	'%1$d further h at %2$s' => '%1$d weitere Std. à %2$s',
	'%1$d h booked, %2$d h charged' => '%1$d Std. gebucht, %2$d Std. berechnet',
	'%1$d extra guests at %2$s' => '%1$d zusätzliche Gäste à %2$s',
	'%d nights' => '%d Nächte',
	'Choose an apartment, a date and a time to see the price.' => 'Wählen Sie Wohnung, Datum und Uhrzeit, um den Preis zu sehen.',
	'This apartment is already taken for that window.' => 'Diese Wohnung ist in diesem Zeitraum bereits belegt.',
	'This apartment has no rates set, so the price is provisional.' => 'Für diese Wohnung sind keine Tarife hinterlegt, der Preis ist daher vorläufig.',
	'No start times for this date. Check the opening hours in Settings.' => 'Keine Startzeiten für dieses Datum. Prüfen Sie die Öffnungszeiten in den Einstellungen.',
	'Give a date.' => 'Geben Sie ein Datum an.',
	'That apartment does not exist.' => 'Diese Wohnung existiert nicht.',
	'Preview' => 'Vorschau',
	'Email preview' => 'E-Mail-Vorschau',
	'The logo, header and footer are added automatically from Settings.' => 'Logo, Kopf- und Fußzeile werden automatisch aus den Einstellungen ergänzt.',
	'Your company logo. Printed at the top of the invoice and shown in the header of every guest email.' => 'Ihr Firmenlogo. Wird oben auf der Rechnung gedruckt und im Kopf jeder Gast-E-Mail angezeigt.',
	'Bereits bezahlt:' => 'Bereits bezahlt:',
	'Offener Betrag:' => 'Offener Betrag:',
	'Anna' => 'Anna',
	'Anna Schmidt' => 'Anna Schmidt',
	'Studio Rheinblick' => 'Studio Rheinblick',
	'Company' => 'Unternehmen',
	'Company information' => 'Unternehmensdaten',
	'Company name' => 'Firmenname',
	'Company logo' => 'Firmenlogo',
	'Notifications' => 'Benachrichtigungen',
	'Legal & invoice' => 'Rechtliches & Rechnung',
	'Entered once here, and used on the invoice and in the header of every guest email.' => 'Einmal hier eingetragen und auf der Rechnung sowie im Kopf jeder Gast-E-Mail verwendet.',
	'Rules applied when a booking is taken.' => 'Regeln, die bei jeder Buchung greifen.',
	'How guests pay you.' => 'Wie Gäste bei Ihnen bezahlen.',
	'Email sent by the plugin.' => 'E-Mails, die das Plugin versendet.',
	'The invoice the guest receives, and the pages it and the booking flow link to.' => 'Die Rechnung für den Gast und die Seiten, auf die sie und der Buchungsablauf verweisen.',
	'Turnaround time is set per apartment. Open an apartment and choose its cleaning time — 30, 45 or 60 minutes — and that gap is kept free before and after every booking in it.' => 'Die Pufferzeit wird je Wohnung festgelegt. Öffnen Sie eine Wohnung und wählen Sie dort die Reinigungszeit — 30, 45 oder 60 Minuten — dieser Abstand bleibt vor und nach jeder Buchung in dieser Wohnung frei.',
	'Account holder' => 'Kontoinhaber',
	'Bank' => 'Bank',
	'IBAN' => 'IBAN',
	'BIC' => 'BIC',
	'IBAN: %s' => 'IBAN: %s',
	'BIC: %s' => 'BIC: %s',
	'Bankverbindung:' => 'Bankverbindung:',
	'Additional details' => 'Weitere Angaben',
	'Anything else to print under the account.' => 'Alles Weitere, das unter der Bankverbindung stehen soll.',
	'Printed on the invoice in groups of four, so a guest can read it across without losing their place.' => 'Wird auf der Rechnung in Vierergruppen gedruckt, damit der Gast sie ohne Verrutschen ablesen kann.',
	'Email notifications' => 'E-Mail-Benachrichtigungen',
	'The master switch. Off stops every guest email, whatever the individual templates say.' => 'Der Hauptschalter. Aus stoppt jede Gast-E-Mail, unabhängig von den einzelnen Vorlagen.',
	'Admin email' => 'E-Mail für Benachrichtigungen',
	'Where notifications for you are sent. Leave empty to use the WordPress admin address.' => 'Wohin Ihre Benachrichtigungen gehen. Leer lassen, um die WordPress-Admin-Adresse zu verwenden.',
	'One line per line, as it should appear on the invoice.' => 'Eine Zeile je Zeile, so wie sie auf der Rechnung erscheinen soll.',
	'Printed at the top of the invoice and shown in the header of every guest email.' => 'Wird oben auf der Rechnung gedruckt und im Kopf jeder Gast-E-Mail angezeigt.',
	'E-Mail: %s' => 'E-Mail: %s',
	'Terms & conditions page' => 'Seite mit den AGB',
	'Privacy policy page' => 'Seite zum Datenschutz',
	'Invoice counter' => 'Rechnungszähler',
	'The next number to issue. Only ever raises the sequence — it cannot reuse a number already sent.' => 'Die nächste zu vergebende Nummer. Sie kann die Zählung nur nach vorn setzen — eine bereits versendete Nummer wird nie erneut vergeben.',
	'Tax rate (%)' => 'Steuersatz (%)',
	'Worked back out of the price, which is what the guest pays. 0 shows no tax line.' => 'Wird aus dem Preis herausgerechnet, den der Gast zahlt. 0 blendet die Steuerzeile aus.',
	'zzgl. %s%% MwSt.:' => 'zzgl. %s%% MwSt.:',
	'Hesse' => 'Hessen',
	'Hesse public holiday' => 'Gesetzlicher Feiertag in Hessen',
	'Give a start and an end date.' => 'Geben Sie ein Start- und ein Enddatum an.',
	'Ask for a shorter range.' => 'Wählen Sie einen kürzeren Zeitraum.',
	'Recorded when the booking was marked paid.' => 'Erfasst, als die Buchung als bezahlt markiert wurde.',
	'Recorded from the booking, which was already marked paid.' => 'Aus der Buchung übernommen, die bereits als bezahlt markiert war.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Calendar Sync' => 'Kalender-Sync',
	'Automatic subscriptions' => 'Automatische Kalender-Abos',
	'Calendar links read every 15 minutes. Dates the portal holds are blocked here; this site’s own bookings are not sent back.' => 'Kalender-Links werden alle 15 Minuten gelesen. Vom Portal belegte Termine werden hier gesperrt; die eigenen Buchungen dieser Website werden nicht zurückgesendet.',
	'One-off file import' => 'Einmaliger Datei-Import',
	'For trying a portal export before subscribing to it, or for a portal that only offers a download.' => 'Zum Ausprobieren eines Portal-Exports, bevor Sie ihn abonnieren – oder für ein Portal, das nur einen Download anbietet.',
	'Export links' => 'Export-Links',
	'Give these to Airbnb or Booking.com and they will block the dates this site has taken. One link per apartment — the same kind of link they give you.' => 'Geben Sie diese an Airbnb oder Booking.com weiter, damit dort die hier belegten Termine gesperrt werden. Ein Link je Apartment – dieselbe Art Link, die Sie von dort erhalten.',
	'The file says only when the apartment is taken — never who by. Anyone holding the link can read it, so treat it as private and replace it if it gets out.' => 'Die Datei nennt nur, wann das Apartment belegt ist – nie durch wen. Wer den Link hat, kann sie lesen: Behandeln Sie ihn vertraulich und ersetzen Sie ihn, falls er nach außen gelangt.',
	'Subscriptions' => 'Abos',
	'%d syncing automatically' => array( '%d wird automatisch synchronisiert', '%d werden automatisch synchronisiert' ),
	'Portals' => 'Portale',
	'Failing' => 'Fehlerhaft',
	'Check the calendar links' => 'Kalender-Links prüfen',
	'Every calendar reads cleanly' => 'Alle Kalender werden fehlerfrei gelesen',
	'Needs a look' => 'Prüfen',
	'Healthy' => 'In Ordnung',
	'Last read' => 'Zuletzt gelesen',
	'Most recent portal read, UTC' => 'Letzter Portal-Abruf, UTC',
	'No calendar read yet' => 'Noch kein Kalender gelesen',
	'Freshness' => 'Aktualität',
	'Next automatic sync' => 'Nächste automatische Synchronisierung',
	'On %s, then every 15 minutes' => 'Am %s, danach alle 15 Minuten',
	'Not scheduled' => 'Nicht eingeplant',
	'Schedule' => 'Zeitplan',
	'Add subscription' => 'Abo hinzufügen',
	'Add a subscription' => 'Kalender-Abo hinzufügen',
	'Edit subscription' => 'Kalender-Abo bearbeiten',
	'Sync all now' => 'Alle jetzt synchronisieren',
	'Sync now' => 'Jetzt synchronisieren',
	'Paused' => 'Pausiert',
	'No calendars subscribed yet' => 'Noch keine Kalender abonniert',
	'Paste the calendar link from Airbnb or Booking.com and their bookings will block those dates here automatically — no more checking two calendars by hand.' => 'Fügen Sie den Kalender-Link von Airbnb oder Booking.com ein – deren Buchungen sperren die Termine dann automatisch hier. Kein manueller Abgleich zweier Kalender mehr.',
	'Not read yet — it will be picked up by the next automatic sync.' => 'Noch nicht gelesen – wird bei der nächsten automatischen Synchronisierung berücksichtigt.',
	'Last read %1$s UTC — %2$s' => 'Zuletzt gelesen %1$s UTC – %2$s',
	'%1$d blocked, %2$d changed, %3$d released' => '%1$d gesperrt, %2$d geändert, %3$d freigegeben',
	'Last sync — %s' => 'Letzte Synchronisierung – %s',
	'Remove this subscription?' => 'Dieses Abo entfernen?',
	'"%s" will stop being read. The dates it already blocked stay blocked unless you say otherwise below.' => '„%s“ wird nicht mehr gelesen. Die bereits gesperrten Termine bleiben gesperrt, sofern Sie unten nichts anderes angeben.',
	'Also release the dates this calendar blocked' => 'Auch die von diesem Kalender gesperrten Termine freigeben',
	'Puts them back on sale. Only do this if the portal is no longer selling the apartment — dates it has sold would otherwise become bookable here too.' => 'Gibt sie wieder zum Verkauf frei. Tun Sie das nur, wenn das Portal das Apartment nicht mehr anbietet – sonst werden dort verkaufte Termine auch hier wieder buchbar.',
	'Booking Suite reads the calendar every 15 minutes and blocks the dates it holds. Nothing is sent to the portal.' => 'Booking Suite liest den Kalender alle 15 Minuten und sperrt die dort belegten Termine. An das Portal wird nichts gesendet.',
	'Portal' => 'Portal',
	'Only used until the first sync — after that the file says who wrote it.' => 'Wird nur bis zur ersten Synchronisierung verwendet – danach sagt die Datei selbst, wer sie erstellt hat.',
	'Calendar link' => 'Kalender-Link',
	'Paste the calendar link.' => 'Fügen Sie den Kalender-Link ein.',
	'That should be a link starting with https:// or webcal://' => 'Das sollte ein Link sein, der mit https:// oder webcal:// beginnt.',
	'Airbnb: Calendar → Availability → Connect calendars. Booking.com: Rates & Availability → Sync calendars.' => 'Airbnb: Kalender → Verfügbarkeit → Kalender verbinden. Booking.com: Preise & Verfügbarkeit → Kalender synchronisieren.',
	'Label (optional)' => 'Bezeichnung (optional)',
	'e.g. Studio · Airbnb' => 'z. B. Studio · Airbnb',
	'Sync this calendar automatically' => 'Diesen Kalender automatisch synchronisieren',
	'Switch off to pause the scheduled pull without losing the link.' => 'Ausschalten, um den geplanten Abruf zu pausieren, ohne den Link zu verlieren.',
	'Import a calendar file' => 'Kalenderdatei importieren',
	'Export the .ics file from Airbnb or Booking.com and upload it here. The dates it holds are blocked for the apartment you choose.' => 'Exportieren Sie die .ics-Datei bei Airbnb oder Booking.com und laden Sie sie hier hoch. Die enthaltenen Termine werden für das gewählte Apartment gesperrt.',
	'Calendar file' => 'Kalenderdatei',
	'Choose an apartment…' => 'Apartment wählen …',
	'Check the file' => 'Datei prüfen',
	'Import these dates' => 'Diese Termine importieren',
	'Calendar imported' => 'Kalender importiert',
	'That did not work' => 'Das hat nicht geklappt',
	'%1$d blocked, %2$d changed, %3$d released.' => '%1$d gesperrt, %2$d geändert, %3$d freigegeben.',
	'Ignore dates that have already passed' => 'Bereits vergangene Termine ignorieren',
	'A portal export usually carries a year of history there is no point blocking.' => 'Ein Portal-Export enthält meist ein Jahr Vergangenheit, die zu sperren keinen Sinn ergibt.',
	'Release dates this calendar no longer holds' => 'Termine freigeben, die dieser Kalender nicht mehr enthält',
	'Makes the apartment match the file exactly, so a cancellation at the portal puts the dates back on sale here. Only affects dates imported from this same portal — never a lock you made yourself.' => 'Bringt das Apartment exakt mit der Datei in Einklang: Eine Stornierung im Portal gibt die Termine hier wieder frei. Betrifft nur Termine aus demselben Portal – nie eine von Ihnen selbst gesetzte Sperrung.',
	'to add' => 'neu',
	'to change' => 'zu ändern',
	'to release' => 'freizugeben',
	'unchanged' => 'unverändert',
	'skipped' => 'übersprungen',
	'%1$s → %2$s' => '%1$s → %2$s',
	'Action' => 'Aktion',
	'Dates' => 'Zeitraum',
	'From the calendar' => 'Aus dem Kalender',
	'New' => 'Neu',
	'Changed' => 'Geändert',
	'Already there' => 'Bereits vorhanden',
	'Skipped' => 'Übersprungen',
	'Double booking' => 'Doppelbuchung',
	'These dates are already sold on this site and the portal has them too. Importing does not cancel anything — settle it at one of the two channels.' => 'Diese Termine sind auf dieser Website bereits verkauft und liegen zugleich beim Portal. Der Import storniert nichts – klären Sie es in einem der beiden Kanäle.',
	'%d date is blocked here but no longer in the calendar' => array( '%d Termin ist hier gesperrt, steht aber nicht mehr im Kalender', '%d Termine sind hier gesperrt, stehen aber nicht mehr im Kalender' ),
	'These will be released, putting the dates back on sale.' => 'Diese werden freigegeben und die Termine wieder zum Verkauf gestellt.',
	'These will be left alone. Switch on "release dates the calendar no longer holds" to remove them.' => 'Diese bleiben unverändert. Aktivieren Sie „Termine freigeben, die dieser Kalender nicht mehr enthält“, um sie zu entfernen.',
	'Create link' => 'Link erstellen',
	'Copy link' => 'Link kopieren',
	'Copied' => 'Kopiert',
	'Download' => 'Herunterladen',
	'Download the .ics file' => 'Die .ics-Datei herunterladen',
	'Replace this link' => 'Diesen Link ersetzen',
	'Replace this link?' => 'Diesen Link ersetzen?',
	'Replace link' => 'Link ersetzen',
	'Calendar link for %s' => 'Kalender-Link für %s',
	'Could not copy automatically — select the link and copy it by hand.' => 'Automatisches Kopieren nicht möglich – markieren Sie den Link und kopieren Sie ihn von Hand.',
	'Not published yet. Creating the link makes this apartment’s booked dates readable by anyone holding it.' => 'Noch nicht veröffentlicht. Sobald der Link erstellt ist, kann jeder, der ihn besitzt, die belegten Termine dieses Apartments lesen.',
	'The current link stops working immediately. Every portal already using it will fail to read the calendar until you give them the new one — so only do this if the link has been shared somewhere it should not have been.' => 'Der bisherige Link funktioniert sofort nicht mehr. Jedes Portal, das ihn nutzt, kann den Kalender erst wieder lesen, wenn Sie ihm den neuen Link geben – tun Sie das also nur, wenn der Link an eine falsche Stelle gelangt ist.',
	'Blocked by a portal (Airbnb, Booking.com)' => 'Von einem Portal gesperrt (Airbnb, Booking.com)',
	'Blocked here' => 'Hier gesperrt',
	'All apartments' => 'Alle Apartments',
	'%d apartment blocked' => array( '%d Apartment gesperrt', '%d Apartments gesperrt' ),
	'%d apartment blocked by a portal' => array( '%d Apartment von einem Portal gesperrt', '%d Apartments von einem Portal gesperrt' ),
	'Nothing booked here — but a portal has the apartments above, so this date is not free.' => 'Hier ist nichts gebucht – die Apartments oben sind jedoch von einem Portal belegt, dieser Tag ist also nicht frei.',
	'Imported from a portal calendar. Change it at the portal — the next sync follows.' => 'Aus einem Portal-Kalender importiert. Ändern Sie es im Portal – die nächste Synchronisierung übernimmt es.',
	'Release it on the Availability screen.' => 'Auf der Seite „Verfügbarkeit“ freigeben.',
	'Open booking %s' => 'Buchung %s öffnen',
	'Mark paid' => 'Als bezahlt markieren',
	'Filter by status' => 'Nach Status filtern',
	'Deleted' => 'Gelöscht',
	'Airbnb' => 'Airbnb',
	'Booking.com' => 'Booking.com',
	'Vrbo' => 'Vrbo',
	'Expedia' => 'Expedia',
	'Tripadvisor' => 'Tripadvisor',
	'Google Calendar' => 'Google Kalender',
	'Manual' => 'Manuell',
	'Not available' => 'Nicht verfügbar',
	'Every 15 minutes' => 'Alle 15 Minuten',
	'Already over.' => 'Bereits vorbei.',
	'Cancelled in the source calendar.' => 'Im Quellkalender storniert.',
	'Marked as free time, not a booking.' => 'Als freie Zeit gekennzeichnet, keine Buchung.',
	'Repeating events are not imported.' => 'Wiederkehrende Termine werden nicht importiert.',
	'The event ends before it starts.' => 'Der Termin endet vor seinem Beginn.',
	'The event has no readable start date.' => 'Der Termin hat kein lesbares Startdatum.',
	'Was %1$s to %2$s.' => 'War %1$s bis %2$s.',
	'%1$d added, %2$d changed, %3$d released.' => '%1$d hinzugefügt, %2$d geändert, %3$d freigegeben.',
	'Choose a calendar file to import.' => 'Wählen Sie eine Kalenderdatei zum Importieren.',
	'Choose which apartment the calendar belongs to.' => 'Wählen Sie, zu welchem Apartment der Kalender gehört.',
	'Choose which apartment this calendar belongs to.' => 'Wählen Sie, zu welchem Apartment dieser Kalender gehört.',
	'Paste the calendar link the portal gave you — it should start with https://' => 'Fügen Sie den Kalender-Link ein, den Sie vom Portal erhalten haben – er sollte mit https:// beginnen.',
	'This apartment already subscribes to that calendar.' => 'Dieses Apartment hat diesen Kalender bereits abonniert.',
	'That apartment no longer exists.' => 'Dieses Apartment existiert nicht mehr.',
	'That calendar subscription no longer exists.' => 'Dieses Kalender-Abo existiert nicht mehr.',
	'The calendar subscription could not be saved.' => 'Das Kalender-Abo konnte nicht gespeichert werden.',
	'That file is not a calendar. Export the .ics file from the portal and upload it unchanged.' => 'Diese Datei ist kein Kalender. Exportieren Sie die .ics-Datei aus dem Portal und laden Sie sie unverändert hoch.',
	'That file is too large to be a calendar export.' => 'Diese Datei ist zu groß für einen Kalender-Export.',
	'That calendar is too large to be a listing export.' => 'Dieser Kalender ist zu groß für einen Inserats-Export.',
	'That is not a usable calendar address.' => 'Das ist keine verwendbare Kalender-Adresse.',
	'The calendar could not be reached: %s' => 'Der Kalender konnte nicht erreicht werden: %s',
	'The portal answered with status %d. Check the calendar link is still valid.' => 'Das Portal antwortete mit Status %d. Prüfen Sie, ob der Kalender-Link noch gültig ist.',
	'Calendar not found.' => 'Kalender nicht gefunden.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Hide' => 'Ausblenden',
	'Show' => 'Einblenden',
	'View payment for %s' => 'Zahlung für %s ansehen',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Settings section' => 'Einstellungsbereich',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Install app' => 'App installieren',
	'Add Booking Suite to your home screen' => 'Booking Suite zum Home-Bildschirm hinzufügen',
	'Add to Home Screen' => 'Zum Home-Bildschirm hinzufügen',
	'Safari cannot do this for you, but it takes three taps.' => 'Safari kann das nicht selbst erledigen – es sind aber nur drei Schritte.',
	'Tap the Share button at the bottom of Safari.' => 'Tippen Sie unten in Safari auf die Teilen-Schaltfläche.',
	'Scroll down and choose "Add to Home Screen".' => 'Scrollen Sie nach unten und wählen Sie „Zum Home-Bildschirm“.',
	'Booking Suite opens full screen from its own icon, with no browser bars.' => 'Booking Suite öffnet sich mit eigenem Symbol im Vollbild, ohne Browserleisten.',
	'Manage bookings, availability and payments.' => 'Buchungen, Verfügbarkeit und Zahlungen verwalten.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Email templates' => 'E-Mail-Vorlagen',
	'Unsaved changes' => 'Nicht gespeicherte Änderungen',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'%d available' => array( '%d verfügbar', '%d verfügbar' ),

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Guest emails' => 'Gäste-E-Mails',
	'Owner emails' => 'Betreiber-E-Mails',
	'The guest\'s email address' => 'E-Mail-Adresse des Gastes',
	'The guest\'s phone number' => 'Telefonnummer des Gastes',
	'Length of stay in nights' => 'Aufenthaltsdauer in Nächten',
	'The one-time verification code' => 'Der einmalige Bestätigungscode',
	'How long that code stays valid' => 'Wie lange dieser Code gültig bleibt',
	'Why the booking was cancelled' => 'Grund der Stornierung',
	'Link to the booking in the admin' => 'Link zur Buchung im Adminbereich',
	'Booking reminder' => 'Erinnerung an den Aufenthalt',
	'A note to the guest shortly before they arrive, with the practicalities.' => 'Eine Nachricht an den Gast kurz vor der Anreise, mit allen praktischen Angaben.',
	'Email verification code' => 'E-Mail-Bestätigungscode',
	'Carries the one-time code that proves the guest owns the address they booked with.' => 'Enthält den einmaligen Code, mit dem der Gast seine E-Mail-Adresse bestätigt.',
	'Booking cancelled' => 'Buchung storniert',
	'Sent to the guest when their booking is called off, whoever cancelled it.' => 'Geht an den Gast, wenn die Buchung storniert wird – unabhängig davon, wer storniert hat.',
	'Booking confirmed (owner)' => 'Buchung bestätigt (Betreiber)',
	'Tells you a booking has been confirmed, with the guest’s contact details.' => 'Informiert Sie über eine bestätigte Buchung, mit den Kontaktdaten des Gastes.',
	'Payment received (owner)' => 'Zahlung eingegangen (Betreiber)',
	'Tells you money has arrived against a booking.' => 'Informiert Sie, dass zu einer Buchung Geld eingegangen ist.',
	'Your stay is coming up — {{reference}}' => 'Ihr Aufenthalt steht bevor – {{reference}}',
	'Your verification code: {{otp_code}}' => 'Ihr Bestätigungscode: {{otp_code}}',
	'Your booking has been cancelled — {{reference}}' => 'Ihre Buchung wurde storniert – {{reference}}',
	'Booking confirmed: {{apartment}}, {{check_in}} — {{reference}}' => 'Buchung bestätigt: {{apartment}}, {{check_in}} – {{reference}}',
	'Payment received: {{amount_paid}} — {{reference}}' => 'Zahlung eingegangen: {{amount_paid}} – {{reference}}',
	'<h1>We are looking forward to having you</h1>
<p>Hello {{guest_first_name}},</p>
<p>Your stay at {{apartment}} is coming up. Here are the details again.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>Guests</th><td>{{guests}}</td></tr>
</table>
<p>If anything about your arrival has changed, reply to this email and let us know.</p>
<p>{{site_name}}</p>' => '<h1>Wir freuen uns auf Sie</h1>
<p>Hallo {{guest_first_name}},</p>
<p>Ihr Aufenthalt in {{apartment}} steht bevor. Hier noch einmal die Details.</p>
<table>
<tr><th>Referenz</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Gäste</th><td>{{guests}}</td></tr>
</table>
<p>Sollte sich an Ihrer Anreise etwas geändert haben, antworten Sie einfach auf diese E-Mail.</p>
<p>{{site_name}}</p>',
	'<h1>Your verification code</h1>
<p>Hello,</p>
<p>Use this code to confirm your email address:</p>
<blockquote><strong>{{otp_code}}</strong></blockquote>
<p>It is valid for {{otp_minutes}} minutes. If you did not ask for it, you can ignore this message — nothing has been booked.</p>
<p>{{site_name}}</p>' => '<h1>Ihr Bestätigungscode</h1>
<p>Hallo,</p>
<p>Bestätigen Sie Ihre E-Mail-Adresse mit diesem Code:</p>
<blockquote><strong>{{otp_code}}</strong></blockquote>
<p>Er ist {{otp_minutes}} Minuten gültig. Falls Sie ihn nicht angefordert haben, können Sie diese Nachricht ignorieren – es wurde nichts gebucht.</p>
<p>{{site_name}}</p>',
	'<h1>Your booking has been cancelled</h1>
<p>Hello {{guest_first_name}},</p>
<p>Your booking has been cancelled and the dates released.</p>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>Reason</th><td>{{cancel_reason}}</td></tr>
</table>
<p>Anything already paid will be refunded to the account it came from. Do reply if you would like to book other dates.</p>
<p>{{site_name}}</p>' => '<h1>Ihre Buchung wurde storniert</h1>
<p>Hallo {{guest_first_name}},</p>
<p>Ihre Buchung wurde storniert und die Termine wieder freigegeben.</p>
<table>
<tr><th>Referenz</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Grund</th><td>{{cancel_reason}}</td></tr>
</table>
<p>Bereits gezahlte Beträge werden auf das Konto zurückerstattet, von dem sie stammen. Antworten Sie gern, wenn Sie andere Termine buchen möchten.</p>
<p>{{site_name}}</p>',
	'<h1>Booking confirmed</h1>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Arrival</th><td>{{check_in}}</td></tr>
<tr><th>Departure</th><td>{{check_out}}</td></tr>
<tr><th>Guests</th><td>{{guests}}</td></tr>
<tr><th>Guest</th><td>{{guest_name}}</td></tr>
<tr><th>Email</th><td>{{guest_email}}</td></tr>
<tr><th>Phone</th><td>{{guest_phone}}</td></tr>
<tr><th>Total</th><td>{{total}}</td></tr>
<tr><th>Payment</th><td>{{payment_status}}</td></tr>
</table>
<p><a href="{{admin_url}}">Open this booking in the admin</a></p>' => '<h1>Buchung bestätigt</h1>
<table>
<tr><th>Referenz</th><td>{{reference}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Anreise</th><td>{{check_in}}</td></tr>
<tr><th>Abreise</th><td>{{check_out}}</td></tr>
<tr><th>Gäste</th><td>{{guests}}</td></tr>
<tr><th>Gast</th><td>{{guest_name}}</td></tr>
<tr><th>E-Mail</th><td>{{guest_email}}</td></tr>
<tr><th>Telefon</th><td>{{guest_phone}}</td></tr>
<tr><th>Gesamt</th><td>{{total}}</td></tr>
<tr><th>Zahlung</th><td>{{payment_status}}</td></tr>
</table>
<p><a href="{{admin_url}}">Buchung im Adminbereich öffnen</a></p>',
	'<h1>Payment received</h1>
<table>
<tr><th>Reference</th><td>{{reference}}</td></tr>
<tr><th>Guest</th><td>{{guest_name}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Invoice</th><td>{{invoice_no}}</td></tr>
<tr><th>Received</th><td>{{amount_paid}}</td></tr>
<tr><th>Still to pay</th><td>{{amount_due}}</td></tr>
<tr><th>Booking total</th><td>{{total}}</td></tr>
</table>
<p><a href="{{admin_url}}">Open this booking in the admin</a></p>' => '<h1>Zahlung eingegangen</h1>
<table>
<tr><th>Referenz</th><td>{{reference}}</td></tr>
<tr><th>Gast</th><td>{{guest_name}}</td></tr>
<tr><th>Apartment</th><td>{{apartment}}</td></tr>
<tr><th>Rechnung</th><td>{{invoice_no}}</td></tr>
<tr><th>Eingegangen</th><td>{{amount_paid}}</td></tr>
<tr><th>Offen</th><td>{{amount_due}}</td></tr>
<tr><th>Buchungssumme</th><td>{{total}}</td></tr>
</table>
<p><a href="{{admin_url}}">Buchung im Adminbereich öffnen</a></p>',

	// Booking delete, the calendar filter, and the calendar links on the
	// apartment form.
	'Delete booking' => 'Buchung löschen',
	'Delete this booking?' => 'Diese Buchung löschen?',
	'%1$s (%2$s) will be erased for good, together with its payments and invoices. Nothing is kept and this cannot be undone. To free the dates without losing the booking, release it instead.' => '%1$s (%2$s) wird endgültig gelöscht, zusammen mit allen Zahlungen und Rechnungen. Es bleibt nichts erhalten und das kann nicht rückgängig gemacht werden. Um nur die Termine freizugeben, ohne die Buchung zu verlieren, geben Sie sie stattdessen frei.',
	'The booking could not be deleted.' => 'Die Buchung konnte nicht gelöscht werden.',
	'Show one apartment' => 'Ein Apartment anzeigen',
	'Calendar sync' => 'Kalender-Sync',
	'Export link (.ics)' => 'Export-Link (.ics)',
	'Export link for this apartment' => 'Export-Link für dieses Apartment',
	'Create export link' => 'Export-Link erstellen',
	'Save the apartment first — the export link can be created once it exists.' => 'Speichern Sie das Apartment zuerst — der Export-Link kann erstellt werden, sobald es existiert.',
	'Not published yet. Creating the link makes this apartment’s booked dates readable by anyone holding it — it says when the apartment is taken, never who by.' => 'Noch nicht veröffentlicht. Sobald der Link erstellt ist, kann jeder, der ihn besitzt, die belegten Termine dieses Apartments lesen — er nennt nur, wann das Apartment belegt ist, niemals durch wen.',
	'Give this to Airbnb or Booking.com and they will block the dates this site has taken. Treat it as private; it can be replaced on the Calendar sync screen if it gets out.' => 'Geben Sie ihn an Airbnb oder Booking.com weiter, dann sperren diese die hier belegten Termine. Behandeln Sie ihn vertraulich; auf der Seite „Kalender-Sync“ kann er ersetzt werden, falls er in falsche Hände gerät.',

	// The calendar subscriptions an apartment carries, on both the Booking
	// Suite form and the post editor meta box.
	'Subscriptions (import)' => 'Abonnements (Import)',
	'Dates these calendars have sold are pulled in and blocked here, so the apartment cannot be booked twice. Read automatically on a schedule; nothing is sent back to the portal.' => 'Dort belegte Termine werden übernommen und hier gesperrt, damit das Apartment nicht doppelt gebucht werden kann. Wird planmäßig automatisch gelesen; an das Portal wird nichts zurückgesendet.',
	'Keep this apartment in step with Airbnb, Booking.com and anywhere else it is listed. Subscribe to as many calendars as it has portals, and publish one of its own.' => 'Halten Sie dieses Apartment mit Airbnb, Booking.com und allen anderen Portalen im Gleichtakt, auf denen es gelistet ist. Abonnieren Sie so viele Kalender wie es Portale gibt — und veröffentlichen Sie einen eigenen.',
	'No calendars subscribed. Add one to block the dates another portal has already sold.' => 'Keine Kalender abonniert. Fügen Sie einen hinzu, um Termine zu sperren, die ein anderes Portal bereits belegt hat.',
	'Remove this subscription' => 'Dieses Abonnement entfernen',
	'Sync automatically' => 'Automatisch synchronisieren',
	'Not read yet.' => 'Noch nicht gelesen.',
	'Saved with the apartment, then read on the next scheduled sync.' => 'Wird mit dem Apartment gespeichert und beim nächsten planmäßigen Abgleich gelesen.',
	'Last read %1$d entries on %2$s' => 'Zuletzt %1$d Einträge gelesen am %2$s',
	'Last read failed: %s' => 'Letztes Lesen fehlgeschlagen: %s',
	'no reason given' => 'kein Grund angegeben',
	'That calendar is listed twice. Each subscription needs its own link.' => 'Dieser Kalender ist zweimal aufgeführt. Jedes Abonnement braucht seinen eigenen Link.',
	'Publish this apartment’s calendar when I save' => 'Kalender dieses Apartments beim Speichern veröffentlichen',
	'%d calendar link was not saved — it is not a usable address, or the same calendar was listed twice.' => array(
		'%d Kalender-Link wurde nicht gespeichert — er ist keine brauchbare Adresse, oder derselbe Kalender wurde zweimal aufgeführt.',
		'%d Kalender-Links wurden nicht gespeichert — sie sind keine brauchbaren Adressen, oder derselbe Kalender wurde zweimal aufgeführt.',
	),

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Export links (.ics)' => 'Export-Links (.ics)',
	'Create export links' => 'Export-Links erstellen',
	'All channels' => 'Alle Kanäle',
	'For %s' => 'Für %s',
	'Direct bookings only' => 'Nur Direktbuchungen',
	'Direct bookings + %s' => 'Direktbuchungen + %s',
	'Export link — %s' => 'Export-Link – %s',
	'Save the apartment first — the export links can be created once it exists.' => 'Speichern Sie das Apartment zuerst – die Export-Links können erstellt werden, sobald es existiert.',
	'Not published yet. Creating them makes this apartment’s booked dates readable by anyone holding a link — each says when the apartment is taken, never who by.' => 'Noch nicht veröffentlicht. Sobald die Links erstellt sind, kann jeder, der einen davon besitzt, die belegten Termine dieses Apartments lesen – sie nennen nur, wann es belegt ist, nie durch wen.',
	'%s appear once this apartment imports a portal calendar — until then every link would carry the same dates.' => '%s erscheinen, sobald dieses Apartment einen Portal-Kalender importiert – bis dahin würde jeder Link dieselben Termine enthalten.',
	'Give each link to the portal it is named for. Treat them as private; they can be replaced on the Calendar Sync screen if one gets out.' => 'Geben Sie jeden Link an das Portal weiter, nach dem er benannt ist. Behandeln Sie sie vertraulich; auf der Seite „Kalender-Sync“ lassen sie sich ersetzen, falls einer nach außen gelangt.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'The other half of the same sync. Each link is shaped for one portal and leaves out that portal’s own dates, so nothing is sent back where it came from.' => 'Die andere Hälfte derselben Synchronisation. Jeder Link ist auf ein Portal zugeschnitten und lässt die eigenen Termine dieses Portals aus, sodass nichts dorthin zurückgeschickt wird, woher es kam.',
	'%s appear once a subscription above names a portal — until then every link would carry the same dates.' => '%s erscheinen, sobald ein Abonnement oben ein Portal benennt – bis dahin würde jeder Link dieselben Termine enthalten.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Give this one to any portal you do not import from.' => 'Geben Sie diesen an jedes Portal weiter, von dem Sie nicht importieren.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Not published yet. Creating the links makes this apartment’s booked dates readable by anyone holding one — each says when the apartment is taken, never who by.' => 'Noch nicht veröffentlicht. Sobald die Links erstellt sind, kann jeder, der einen davon besitzt, die belegten Termine dieses Apartments lesen – sie nennen nur, wann das Apartment belegt ist, nie durch wen.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Give each link to the portal it is named for. Treat them as private: anyone holding one can read when this apartment is taken.' => 'Geben Sie jeden Link an das Portal weiter, nach dem er benannt ist. Behandeln Sie sie vertraulich: Wer einen davon besitzt, kann lesen, wann dieses Apartment belegt ist.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Airbnb: Calendar → Availability → Connect calendars.' => 'Airbnb: Kalender → Verfügbarkeit → Kalender verbinden.',
	'Booking.com: Rates & Availability → Sync calendars.' => 'Booking.com: Preise & Verfügbarkeit → Kalender synchronisieren.',
	'Paste the calendar link this portal gave you.' => 'Fügen Sie den Kalender-Link ein, den Ihnen dieses Portal gegeben hat.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Calendar link — %s' => 'Kalender-Link – %s',
	'Dates these portals have sold are blocked here, read automatically on a schedule.' => 'Von diesen Portalen belegte Termine werden hier gesperrt, automatisch nach Zeitplan gelesen.',
	'Give each to the portal it is named for. Each leaves out that portal’s own dates, and is readable by anyone holding it.' => 'Geben Sie jeden an das Portal weiter, nach dem er benannt ist. Jeder lässt die eigenen Termine dieses Portals aus und ist für jeden lesbar, der ihn besitzt.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'Reading…' => 'Wird gelesen…',
	'Every 5 minutes' => 'Alle 5 Minuten',
	'Could not read the calendars just now. Try again in a moment.' => 'Die Kalender konnten gerade nicht gelesen werden. Versuchen Sie es gleich noch einmal.',
	'Nothing to read — no calendar link is saved yet.' => 'Nichts zu lesen – es ist noch kein Kalender-Link gespeichert.',

	/*
	 * Calendar Sync: importing portal calendars, publishing this site's own,
	 * and the responsive card layouts added alongside them.
	 */
	'The update could not be downloaded (HTTP %d). Check the GitHub token in Settings.' => 'Das Update konnte nicht heruntergeladen werden (HTTP %d). Prüfen Sie den GitHub-Token in den Einstellungen.',

	/*
	 * Calendar: the Month / Week / Day view switcher and the hour grid the
	 * week and day views are drawn on.
	 */
	'Calendar view' => 'Kalenderansicht',
	'Month' => 'Monat',
	'Week' => 'Woche',
	'Day' => 'Tag',
	'All day' => 'Ganztägig',

	/*
	 * The booking history: what was changed on a booking, by whom and when,
	 * and the full payment ledger beside it.
	 */
	'History' => 'Verlauf',
	'Booking created' => 'Buchung erstellt',
	'Booking changed' => 'Buchung geändert',
	'Payment recorded' => 'Zahlung erfasst',
	'Payment amount changed' => 'Zahlungsbetrag geändert',
	'Payment status changed' => 'Zahlungsstatus geändert',
	'Invoice issued' => 'Rechnung erstellt',
	'Email sent to the guest' => 'E-Mail an den Gast gesendet',
	'Template' => 'Vorlage',
	'Delivery' => 'Zustellung',
	'Scheduled task' => 'Geplante Aufgabe',
	'Website' => 'Website',
	'%1$s · %2$s' => '%1$s · %2$s',
	'Payment history' => 'Zahlungsverlauf',
	'Awaiting payment' => 'Zahlung ausstehend',
	'Failed' => 'Fehlgeschlagen',
	'Still outstanding' => 'Noch offen',
	'Bank transfer' => 'Überweisung',
	'Cash' => 'Bar',
	'Card' => 'Karte',

	/*
	 * The guest review step: one price for the apartment rather than a line
	 * per night, and both ends of the booking spelled out.
	 */
	'Base price' => 'Grundpreis',
	'includes %s off' => 'inkl. %s Rabatt',

	/*
	 * Email verification: the one-time code that proves a guest owns the
	 * address they are booking with. Guest-facing, so formal "Sie".
	 */
	'Confirm your email' => 'E-Mail-Adresse bestätigen',
	'Confirm' => 'Bestätigen',
	'We have sent a six-digit code to %s. Enter it below to continue.' => 'Wir haben einen sechsstelligen Code an %s gesendet. Geben Sie ihn unten ein, um fortzufahren.',
	'Verification code' => 'Bestätigungscode',
	'Checking…' => 'Wird geprüft…',
	'Email confirmed.' => 'E-Mail-Adresse bestätigt.',
	'Send a new code' => 'Neuen Code senden',
	'You can ask for another code in %d seconds.' => 'In %d Sekunden können Sie einen neuen Code anfordern.',
	'Check your spam folder if it has not arrived. Nothing is booked until you finish.' => 'Schauen Sie bitte auch im Spam-Ordner nach. Es ist noch nichts gebucht, solange Sie nicht fertig sind.',
	'That code is not right. Please check it and try again.' => 'Dieser Code stimmt nicht. Bitte prüfen Sie ihn und versuchen Sie es erneut.',
	'That code has expired. Please ask for a new one.' => 'Dieser Code ist abgelaufen. Bitte fordern Sie einen neuen an.',
	'Too many wrong codes. Please ask for a new one.' => 'Zu viele falsche Codes. Bitte fordern Sie einen neuen an.',
	'A code was just sent. Please wait a moment before asking for another.' => 'Es wurde gerade ein Code gesendet. Bitte warten Sie einen Moment, bevor Sie einen neuen anfordern.',
	'Too many codes have been sent to this address. Please try again later.' => 'An diese Adresse wurden zu viele Codes gesendet. Bitte versuchen Sie es später erneut.',
	'The code could not be sent. Please check the address and try again.' => 'Der Code konnte nicht gesendet werden. Bitte prüfen Sie die Adresse und versuchen Sie es erneut.',
	'Please confirm your email address before booking.' => 'Bitte bestätigen Sie Ihre E-Mail-Adresse, bevor Sie buchen.',

	/*
	 * Bank details: on the payment step of the booking modal, and appended to
	 * any guest email about a booking with money still owing.
	 *
	 * "Falls Sie noch nicht überwiesen haben" rather than "Bitte überweisen
	 * Sie": by the time most of these emails go out the guest has already
	 * paid and uploaded the receipt, and being chased for money they have
	 * already sent is how a stay starts badly.
	 */
	'Bank details' => 'Bankverbindung',
	'Transfer the amount to' => 'Überweisen Sie den Betrag an',
	'Payment reference' => 'Verwendungszweck',
	'If you have not paid yet, please transfer %s to the account below. Once it arrives we will confirm your booking by email.' => 'Falls Sie noch nicht überwiesen haben, senden Sie den offenen Betrag von %s bitte an das unten stehende Konto. Sobald er bei uns eingegangen ist, bestätigen wir Ihre Buchung per E-Mail.',
	'For your records, these are the account details your payment was made to.' => 'Zu Ihrer Information: Dies sind die Kontodaten, an die Ihre Zahlung gegangen ist.',
	'Please quote %s as the payment reference so we can match your transfer to your booking.' => 'Bitte geben Sie %s als Verwendungszweck an, damit wir Ihre Überweisung Ihrer Buchung zuordnen können.',
	'Please put your name in the payment reference. We will send you the booking number by email.' => 'Bitte geben Sie Ihren Namen als Verwendungszweck an. Die Buchungsnummer senden wir Ihnen per E-Mail.',
	'Your bank account, with a note on how to pay' => 'Ihre Bankverbindung, mit einem Hinweis zur Zahlung',

	/*
	 * The apartments list gained a short-link column; the link itself is now
	 * minted when an apartment is published.
	 */
	'Short link' => 'Kurzlink',
	'Copy short link' => 'Kurzlink kopieren',
	'Not published yet' => 'Noch nicht veröffentlicht',
);
