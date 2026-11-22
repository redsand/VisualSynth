// What the CROWD sees for a track: the song and the artist, nothing else.
// DJ-pool files carry version noise — "(Intro Clean)", "(DJcity Intro -
// Clean)", "[Dirty]", "(Clean Extended)", " - Lincoln Baio Halloween Remix",
// pool names in the album field — which confused the room at a live show
// (2026-11-21). Strip it; keep a plain "(Remix)"-style word only when the
// song title would otherwise be empty.

const POOLS = [
  'djcity', 'dj city', 'bpm supreme', 'bpmsupreme', 'club killers', 'clubkillers', 'crooklyn clan', 'heavy hits',
  'zipdj', 'zip dj', 'dj beat breaks', 'mymp3pool', 'mp3pool', 'promo only', 'late night record pool', 'hood hitz',
  'franchise', 'direct music service', 'dms', 'beatport', 'beatsource', 'digital dj pool', 'ddp', 'smashvision',
  'xmix', 'x-mix', 'ultimix', 'funkymix', 'dj promo', 'record pool', 'mixshow', 'lincoln baio'
];

const VERSION_WORDS = [
  'clean', 'dirty', 'explicit', 'censored', 'radio', 'intro', 'outro', 'extended', 'short', 'edit', 'quick hit',
  'quickhit', 'hype', 'redrum', 'transition', 'acapella', 'a cappella', 'instrumental', 'version', 'vip', 'remix',
  'mix', 'bootleg', 'mashup', 'flip', 'blend', 'snip', 'break', 'drop', 'tool', 'main', 'original', 'club', 'dub',
  'halloween', 'christmas', 'xmas', 'bpm', 'loop', 'verse', 'chorus'
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const POOL_RE = new RegExp(`\\b(${POOLS.map(escape).join('|')})\\b`, 'i');
const VERSION_RE = new RegExp(`\\b(${VERSION_WORDS.map(escape).join('|')})\\b`, 'i');
const isNoise = (s: string) => POOL_RE.test(s) || VERSION_RE.test(s) || /\b\d{2,3}\s*bpm\b/i.test(s);

const tidy = (s: string) => s.replace(/\s{2,}/g, ' ').replace(/\s+([,)\]])/g, '$1').replace(/[\s\-–—:|]+$/g, '').replace(/^[\s\-–—:|]+/g, '').trim();

/** Title for display: drop bracketed/dashed version and pool tags. */
export const cleanTitleForDisplay = (title?: string): string => {
  const raw = (title ?? '').trim();
  if (!raw) return '';
  // Bracketed groups that are version/pool noise: "(Intro Clean)", "[Dirty]".
  let t = raw.replace(/\s*[([{][^)\]}]*[)\]}]/g, (group) => (isNoise(group) ? ' ' : group));
  // Dashed tails that are version/pool noise: " - Lincoln Baio Halloween Remix".
  const parts = t.split(/\s+[-–—]\s+/);
  while (parts.length > 1 && isNoise(parts[parts.length - 1])) parts.pop();
  t = tidy(parts.join(' - '));
  return t || tidy(raw.replace(/[([{][^)\]}]*[)\]}]/g, ' ')) || raw;
};

/** Artist for display: drop pool names / version tags tacked onto the artist. */
export const cleanArtistForDisplay = (artist?: string): string => {
  const raw = (artist ?? '').trim();
  if (!raw) return '';
  const a = tidy(raw.replace(/\s*[([{][^)\]}]*[)\]}]/g, (group) => (POOL_RE.test(group) || /\b(clean|dirty|explicit)\b/i.test(group) ? ' ' : group)));
  return a || raw;
};
