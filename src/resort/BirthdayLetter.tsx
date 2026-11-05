import { useId } from 'react';
import { site } from '../site';
import './BirthdayLetter.css';

/** The paper stays in normal flow so every line remains readable when opened. */
export default function BirthdayLetter({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const id = useId();
  const paperId = `${id}-letter`;
  const pinkId = `${id}-pink`;
  const flapId = `${id}-flap`;
  const letter = site.celebration.letter;

  return (
    <div className={`gift-envelope${open ? ' is-open' : ''}`}>
      <div className="gift-envelope-reveal" aria-hidden={!open} inert={!open}>
        <div className="gift-envelope-paper-wrap">
          <article className="gift-envelope-paper" id={paperId} aria-label={letter.title}>
            <span className="gift-envelope-paper-heart" aria-hidden="true">
              ♡
            </span>
            <h3>{letter.title}</h3>
            {letter.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <div className="gift-envelope-signature">{letter.signature}</div>
          </article>
        </div>
      </div>
      <button
        type="button"
        className="gift-envelope-button"
        onClick={onToggle}
        aria-label={open ? `收起${letter.title}` : `打开${letter.title}`}
        aria-expanded={open}
        aria-controls={paperId}
      >
        <span className="gift-envelope-art" aria-hidden="true">
          <span className="gift-envelope-back" />
          <svg className="gift-envelope-folds" viewBox="0 0 360 146" preserveAspectRatio="none">
            <defs>
              <linearGradient id={pinkId} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#f2c4ca" />
                <stop offset="1" stopColor="#e7aebc" />
              </linearGradient>
            </defs>
            <path d="M1 1 180 94 359 1V138Q359 145 351 145H9Q1 145 1 138Z" fill={`url(#${pinkId})`} />
            <path
              d="M1 3 136 78 1 140M359 3 224 78 359 140"
              fill="#ecc0ca"
              stroke="#db9eac"
              strokeWidth=".7"
            />
            <path d="m4 141 155-88q21-12 42 0l155 88" fill="#f3cbd1" stroke="#dfa9b5" strokeWidth=".8" />
          </svg>
          <span className="gift-envelope-flap">
            <svg viewBox="0 0 360 112" preserveAspectRatio="none">
              <defs>
                <linearGradient id={flapId} x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#f7d8dc" />
                  <stop offset="1" stopColor="#e7b5c2" />
                </linearGradient>
              </defs>
              <path
                d="M1 1H359L196 105Q180 116 164 105Z"
                fill={`url(#${flapId})`}
                stroke="#e0a5b3"
                strokeWidth="1"
              />
            </svg>
          </span>
          <span className="gift-envelope-seal">
            <svg viewBox="0 0 24 24">
              <path d="M12 20 3.6 12a5.2 5.2 0 0 1 7.3-7.3L12 5.8l1.1-1.1a5.2 5.2 0 0 1 7.3 7.3Z" />
            </svg>
          </span>
          <span className="gift-envelope-recipient">{letter.title}</span>
        </span>
        <span className="gift-envelope-action">{open ? '收好小笺' : '轻轻拆开'}</span>
      </button>
    </div>
  );
}
