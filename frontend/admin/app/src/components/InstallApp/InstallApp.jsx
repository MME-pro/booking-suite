/**
 * InstallApp — offers to put the admin on the operator's home screen.
 *
 * A manifest alone makes an app installable but says nothing about it, and the
 * browser menu item that does the installing is buried three taps deep on both
 * platforms. This is the visible offer.
 *
 * The two platforms need opposite handling, which is most of the code here.
 *
 * Chrome fires `beforeinstallprompt` when it decides the site qualifies, and
 * that event is the only way to open the install dialog — it cannot be
 * conjured later, so it is caught and kept. Safari fires nothing and has no
 * API at all: on iOS the operator has to use Share → Add to Home Screen
 * themselves, so all that can be offered is a clear instruction.
 *
 * Nothing renders at all when the app is already installed, or on a desktop
 * that fired no event. An "Install" button that does nothing when pressed is
 * worse than no button, and this is a toolbar that has to stay quiet.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Share, Smartphone } from 'lucide-react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Whether the page is already running as an installed app.
 *
 * Two checks because the platforms report it differently: `display-mode` is the
 * standard, `navigator.standalone` is what iOS has instead.
 *
 * @return {boolean} True when launched from the home screen.
 */
function isInstalled() {
	const standalone = window.matchMedia?.( '(display-mode: standalone)' );

	return Boolean( standalone?.matches || window.navigator?.standalone );
}

/**
 * iOS Safari, where installing is a manual gesture and there is no API for it.
 *
 * Chrome and Firefox on iOS are Safari underneath and behave the same way, so
 * the platform is what is tested, not the browser name.
 *
 * @return {boolean} True on an iPhone or iPad.
 */
function isIos() {
	const ua = window.navigator?.userAgent ?? '';

	return (
		/iPad|iPhone|iPod/.test( ua ) ||
		// iPadOS reports itself as a Mac; the touch points give it away.
		( 'MacIntel' === window.navigator?.platform &&
			window.navigator?.maxTouchPoints > 1 )
	);
}

export default function InstallApp() {
	/** The captured Chrome event, or null when it has not fired. */
	const [ prompt, setPrompt ] = useState( null );
	const [ installed, setInstalled ] = useState( () => isInstalled() );
	const [ showingIosHelp, setShowingIosHelp ] = useState( false );

	useEffect( () => {
		const onBeforeInstall = ( event ) => {
			// Chrome shows its own mini-infobar unless this is called, and the
			// event is only usable later if it has been prevented here.
			event.preventDefault();
			setPrompt( event );
		};

		const onInstalled = () => {
			setInstalled( true );
			setPrompt( null );
		};

		window.addEventListener( 'beforeinstallprompt', onBeforeInstall );
		window.addEventListener( 'appinstalled', onInstalled );

		return () => {
			window.removeEventListener(
				'beforeinstallprompt',
				onBeforeInstall
			);
			window.removeEventListener( 'appinstalled', onInstalled );
		};
	}, [] );

	if ( installed ) {
		return null;
	}

	const ios = isIos();

	// Nothing to offer: not iOS, and Chrome has not said it qualifies.
	if ( ! ios && ! prompt ) {
		return null;
	}

	const install = async () => {
		if ( ios ) {
			setShowingIosHelp( true );
			return;
		}

		prompt.prompt();

		const { outcome } = await prompt.userChoice;

		/*
		 * The event is single-use whichever way it goes. Dropping it hides the
		 * button rather than leaving one that silently does nothing on a second
		 * press; Chrome fires a fresh event if it still qualifies.
		 */
		setPrompt( null );

		if ( 'accepted' === outcome ) {
			setInstalled( true );
		}
	};

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				onClick={ install }
				title={ __(
					'Add Booking Suite to your home screen',
					'booking-suite'
				) }
			>
				<Smartphone className="h-4 w-4 shrink-0" />
				<span className="hidden sm:inline">
					{ __( 'Install app', 'booking-suite' ) }
				</span>
			</Button>

			<Dialog open={ showingIosHelp } onOpenChange={ setShowingIosHelp }>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{ __( 'Add to Home Screen', 'booking-suite' ) }
						</DialogTitle>
						<DialogDescription>
							{ __(
								'Safari cannot do this for you, but it takes three taps.',
								'booking-suite'
							) }
						</DialogDescription>
					</DialogHeader>

					<ol className="flex flex-col gap-3 text-sm text-card-foreground">
						<li className="flex items-start gap-2">
							<Share
								aria-hidden="true"
								className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
							/>
							<span>
								{ __(
									'Tap the Share button at the bottom of Safari.',
									'booking-suite'
								) }
							</span>
						</li>
						<li className="flex items-start gap-2">
							<span
								aria-hidden="true"
								className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-semibold text-muted-foreground"
							>
								+
							</span>
							<span>
								{ __(
									'Scroll down and choose "Add to Home Screen".',
									'booking-suite'
								) }
							</span>
						</li>
						<li className="flex items-start gap-2">
							<Smartphone
								aria-hidden="true"
								className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
							/>
							<span>
								{ __(
									'Booking Suite opens full screen from its own icon, with no browser bars.',
									'booking-suite'
								) }
							</span>
						</li>
					</ol>
				</DialogContent>
			</Dialog>
		</>
	);
}
