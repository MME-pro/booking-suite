/**
 * TextInput — borderless control meant to sit inside a Field.
 */

import './TextInput.css';

export default function TextInput( {
	multiline = false,
	rows = 5,
	className = '',
	...props
} ) {
	const classes = [
		'bks-text-input',
		multiline ? 'bks-text-input--multiline' : '',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	if ( multiline ) {
		return <textarea className={ classes } rows={ rows } { ...props } />;
	}

	return <input className={ classes } { ...props } />;
}
