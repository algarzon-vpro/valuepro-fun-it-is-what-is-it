import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '@sinetch/shared';

type Props = {
  messages: ChatMessage[];
  canGuess: boolean;
  onGuess: (text: string, done?: (correct: boolean) => void) => void;
  lockedReason: string | null;
  onChat?: (text: string) => void;
};

export function ChatPanel({ messages, canGuess, onGuess, lockedReason, onChat }: Props) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const inputEnabled = canGuess || !!onChat;
  const disabled = !canGuess && !onChat;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (canGuess) {
      onGuess(value, () => setText(''));
    } else if (onChat) {
      onChat(value);
      setText('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div className="chat-log" ref={logRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-line ${m.type}`}>
            {m.type === 'system' ? (
              <span>{m.text}</span>
            ) : (
              <>
                <span className="who">{m.playerName}: </span>
                <span>{m.text}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {lockedReason && !canGuess && (
        <div style={{ color: 'var(--muted)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
          {lockedReason}
        </div>
      )}
      <form className="chat-form" onSubmit={onSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canGuess ? 'Type your guess…' : 'Message…'}
          disabled={disabled}
          maxLength={120}
        />
        <button type="submit" disabled={disabled || !text.trim() || !inputEnabled}>
          Send
        </button>
      </form>
    </div>
  );
}
