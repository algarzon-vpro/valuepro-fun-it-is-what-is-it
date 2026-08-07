import { useEffect } from 'react';

type Props = {
  show: boolean;
  memeSrc: string | null;
  onDone: () => void;
};

/** Visual stays until parent clears it (synced to Fahhh audio end). Safety timeout only. */
export function WrongGuessMeme({ show, memeSrc, onDone }: Props) {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onDone, 3500);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  if (!show || !memeSrc) return null;

  return (
    <div className="faah-overlay" role="status" aria-live="polite">
      <img src={memeSrc} alt="" className="faah-img" draggable={false} key={memeSrc} />
    </div>
  );
}
