/**
 * The remembrance messages, verbatim as decided by the owner (only accents corrected). Never
 * reworded here: the whispered clips in assets/voice are rendered from the same texts and ids.
 */
export interface Message {
  id: string;
  text: string;
}

export const MESSAGES: readonly Message[] = [
  { id: 'm01', text: 'siempre te recordaré' },
  { id: 'm02', text: 'siempre en mis pensamientos' },
  { id: 'm03', text: 'gracias' },
  { id: 'm04', text: 'sigue así' },
  { id: 'm05', text: 'lo estás haciendo bien' },
  { id: 'm06', text: 'descansa, lo estás haciendo bien' },
  { id: 'm07', text: 'también te extraño' },
] as const;

/** The text as shown: first letter in upper case, the rest as written. */
export function displayText(message: Message): string {
  const t = message.text;
  return t.length === 0 ? t : t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
}
