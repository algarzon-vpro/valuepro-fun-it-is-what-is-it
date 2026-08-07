const FAAH_SRC = '/faah/fahhh.mp3';

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(FAAH_SRC);
    audio.preload = 'auto';
  }
  return audio;
}

/** Play the Fahhh sound; resolves when playback ends (or after a fallback timeout). */
export function playFaah(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const el = getAudio();
      el.pause();
      el.currentTime = 0;
      el.volume = 1;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('ended', finish);
        el.removeEventListener('error', finish);
        window.clearTimeout(fallback);
        resolve();
      };

      const knownMs = Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 + 150 : 2500;
      const fallback = window.setTimeout(finish, knownMs);
      el.addEventListener('ended', finish, { once: true });
      el.addEventListener('error', finish, { once: true });

      const playResult = el.play();
      if (playResult && typeof playResult.then === 'function') {
        playResult.catch(() => finish());
      }
    } catch {
      resolve();
    }
  });
}

export const FAAH_MEMES = [
  '/faah/meme-01.png',
  '/faah/meme-02.png',
  '/faah/meme-03.png',
  '/faah/meme-04.png',
  '/faah/meme-05.png',
  '/faah/meme-06.png',
  '/faah/meme-07.png',
  '/faah/meme-08.png',
  '/faah/meme-09.png',
  '/faah/meme-10.png',
  '/faah/meme-11.png',
  '/faah/meme-12.png',
] as const;

export function pickRandomFaahMeme(exclude?: string | null): string {
  const pool = exclude ? FAAH_MEMES.filter((src) => src !== exclude) : [...FAAH_MEMES];
  const list = pool.length ? pool : [...FAAH_MEMES];
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Warm the audio + images so the first wrong guess feels instant. */
export function preloadFaahAssets() {
  try {
    getAudio().load();
  } catch {
    // ignore
  }
  for (const src of FAAH_MEMES) {
    const img = new Image();
    img.src = src;
  }
}
