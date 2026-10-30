/**
 * The remembrance messages: words a loved one says to someone they have not seen in a long time,
 * to support them and warm them. m01 to m07 are the owner's own, verbatim (only accents corrected);
 * the rest follow the owner's brief ("at least some 50", about remembering, company and support).
 *
 * Every message works for any visitor and either voice: no gendered words about the visitor or the
 * speaker. Excluded on purpose (research-culture D4 risk flags): anything that reads as a call to
 * death ("te espero", "nos vemos pronto"), assigns guilt or assumes a belief.
 *
 * The whispered clips in assets/voice are rendered from the same ids and texts
 * (pipeline/voice/messages.json, checked equal by a test).
 */
export type Theme = 'owner' | 'reunion' | 'memory' | 'company' | 'support';

export interface Message {
  id: string;
  text: string;
  theme: Theme;
}

export const MESSAGES: readonly Message[] = [
  { id: 'm01', text: 'siempre te recordaré', theme: 'owner' },
  { id: 'm02', text: 'siempre en mis pensamientos', theme: 'owner' },
  { id: 'm03', text: 'gracias', theme: 'owner' },
  { id: 'm04', text: 'sigue así', theme: 'owner' },
  { id: 'm05', text: 'lo estás haciendo bien', theme: 'owner' },
  { id: 'm06', text: 'descansa, lo estás haciendo bien', theme: 'owner' },
  { id: 'm07', text: 'también te extraño', theme: 'owner' },
  { id: 'm08', text: 'hoy vine a verte', theme: 'reunion' },
  { id: 'm09', text: 'qué gusto me da verte', theme: 'reunion' },
  { id: 'm10', text: 'cuánto tiempo sin verte', theme: 'reunion' },
  { id: 'm11', text: 'te extrañaba mucho', theme: 'reunion' },
  { id: 'm12', text: 'déjame verte un ratito', theme: 'reunion' },
  { id: 'm13', text: 'tu luz me trajo hasta aquí', theme: 'reunion' },
  { id: 'm14', text: 'seguí las flores hasta ti', theme: 'reunion' },
  { id: 'm15', text: 'gracias por las flores', theme: 'reunion' },
  { id: 'm16', text: 'gracias por acordarte de mí', theme: 'reunion' },
  { id: 'm17', text: 'cada año vuelvo a verte', theme: 'reunion' },
  { id: 'm18', text: 'vine a darte un abrazo', theme: 'reunion' },
  { id: 'm19', text: 'qué bonito es volver a verte', theme: 'reunion' },
  { id: 'm20', text: 'aquí sigo, cerquita de ti', theme: 'memory' },
  { id: 'm21', text: 'sigo en tu corazón', theme: 'memory' },
  { id: 'm22', text: 'te llevo en el corazón', theme: 'memory' },
  { id: 'm23', text: 'nunca me olvido de ti', theme: 'memory' },
  { id: 'm24', text: 'me acuerdo de ti todos los días', theme: 'memory' },
  { id: 'm25', text: 'me acuerdo de tu risa', theme: 'memory' },
  { id: 'm26', text: 'mientras me recuerdes, aquí estoy', theme: 'memory' },
  { id: 'm27', text: 'vivo en tus recuerdos', theme: 'memory' },
  { id: 'm28', text: 'me llevo tu cariño', theme: 'memory' },
  { id: 'm29', text: 'nuestro cariño no se acaba', theme: 'memory' },
  { id: 'm30', text: 'guardo cada momento contigo', theme: 'memory' },
  { id: 'm31', text: 'aquí estoy contigo', theme: 'company' },
  { id: 'm32', text: 'camino a tu lado', theme: 'company' },
  { id: 'm33', text: 'te acompaño aunque no me veas', theme: 'company' },
  { id: 'm34', text: 'estoy más cerca de lo que crees', theme: 'company' },
  { id: 'm35', text: 'siempre te cuido', theme: 'company' },
  { id: 'm36', text: 'seguimos juntos', theme: 'company' },
  { id: 'm37', text: 'nunca me fui del todo', theme: 'company' },
  { id: 'm38', text: 'estoy en cada vela que enciendes', theme: 'company' },
  { id: 'm39', text: 'me quedo un ratito contigo', theme: 'company' },
  { id: 'm40', text: 'te veo y sonrío', theme: 'company' },
  { id: 'm41', text: 'cuánto te quiero', theme: 'support' },
  { id: 'm42', text: 'me llenas de orgullo', theme: 'support' },
  { id: 'm43', text: 'tú puedes', theme: 'support' },
  { id: 'm44', text: 'confía en ti', theme: 'support' },
  { id: 'm45', text: 'todo va a estar bien', theme: 'support' },
  { id: 'm46', text: 'no tengas miedo', theme: 'support' },
  { id: 'm47', text: 'eres más fuerte de lo que crees', theme: 'support' },
  { id: 'm48', text: 've con calma, no hay prisa', theme: 'support' },
  { id: 'm49', text: 'sigue adelante, yo te acompaño', theme: 'support' },
  { id: 'm50', text: 'vive bonito', theme: 'support' },
  { id: 'm51', text: 'sé feliz, te lo mereces', theme: 'support' },
  { id: 'm52', text: 'ríe mucho, me encanta tu risa', theme: 'support' },
  { id: 'm53', text: 'cuida a los tuyos', theme: 'support' },
  { id: 'm54', text: 'abraza fuerte a quien quieres', theme: 'support' },
  { id: 'm55', text: 'abrígate y come bien', theme: 'support' },
  { id: 'm56', text: 'date un descanso, te lo has ganado', theme: 'support' },
  { id: 'm57', text: 'tu esfuerzo vale mucho', theme: 'support' },
  { id: 'm58', text: 'eres luz para los tuyos', theme: 'support' },
  { id: 'm59', text: 'te mando un abrazo grande', theme: 'support' },
  { id: 'm60', text: 'gracias por tanto cariño', theme: 'support' },
  { id: 'm61', text: 'hoy es fiesta, disfrútala', theme: 'support' },
  { id: 'm62', text: 'canta y baila por mí', theme: 'support' },
] as const;

/** The text as shown: first letter in upper case, the rest as written. */
export function displayText(message: Message): string {
  const t = message.text;
  return t.length === 0 ? t : t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
}
