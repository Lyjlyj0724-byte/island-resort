import { useId } from 'react';

/** A companion drawing of the cream-and-berry cake in the seaside scene. */
export default function BirthdayCakeIllustration({
  lit,
  celebrating,
}: {
  lit: boolean;
  celebrating: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const cream = `${id}-cream`;
  const plate = `${id}-plate`;
  const wax = `${id}-wax`;
  const glow = `${id}-glow`;
  const label = lit
    ? '点着蜡烛的奶油莓果蛋糕'
    : celebrating
      ? '奶油莓果蛋糕，蜡烛已经吹灭'
      : '奶油莓果蛋糕，蜡烛尚未点燃';

  return (
    <svg
      className="birthday-cake-illustration"
      viewBox="0 0 480 380"
      role="img"
      aria-label={label}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: 360,
        height: 'auto',
        margin: '0 auto',
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id={cream} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#dcc6ad" />
          <stop offset=".24" stopColor="#f9ead7" />
          <stop offset=".72" stopColor="#fff6e7" />
          <stop offset="1" stopColor="#e1ccb1" />
        </linearGradient>
        <linearGradient id={plate} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fffaf0" />
          <stop offset="1" stopColor="#dbcfbb" />
        </linearGradient>
        <linearGradient id={wax} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#cb8c88" />
          <stop offset=".2" stopColor="#f7d6be" />
          <stop offset=".58" stopColor="#fff5db" />
          <stop offset="1" stopColor="#e6b59d" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop stopColor="#ffdc8b" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffe6ab" stopOpacity="0" />
        </radialGradient>
      </defs>
      {celebrating && (
        <g aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            const r = 145 + (i % 3) * 17;
            return (
              <path
                key={i}
                d="M -2 -6 L 2 -6 L 2 6 L -2 6 Z"
                fill={['#c69d62', '#c98488', '#7d9b7d', '#e7c79e'][i % 4]}
                opacity=".72"
                transform={`translate(${240 + Math.cos(a) * r} ${178 + Math.sin(a) * 113}) rotate(${i * 32})`}
              />
            );
          })}
        </g>
      )}
      <ellipse cx="240" cy="331" rx="160" ry="25" fill="#506247" opacity=".1" />
      <ellipse cx="240" cy="316" rx="163" ry="33" fill={`url(#${plate})`} stroke="#c59c5b" strokeWidth="2" />
      <ellipse cx="240" cy="311" rx="148" ry="27" fill="#f8efdf" stroke="#ead8b5" strokeWidth="1" />
      <path d="M 117 222 L 117 295 C 117 335 363 335 363 295 L 363 222 Z" fill={`url(#${cream})`} />
      {[247, 258, 269, 280, 291].map((y) => (
        <path
          key={y}
          d={`M 119 ${y} C 155 ${y + 29} 325 ${y + 29} 361 ${y}`}
          stroke="#d6bda0"
          strokeWidth=".8"
          fill="none"
          opacity=".35"
        />
      ))}
      <ellipse cx="240" cy="222" rx="123" ry="38" fill="#fff8e9" />
      <path
        d="M 118 222 C 132 233 141 238 156 243 C 161 245 160 258 167 258 C 174 258 170 246 177 247 C 193 251 205 253 219 253 C 225 253 221 270 229 270 C 237 270 233 254 239 254 C 268 254 290 250 305 247 C 313 245 308 258 316 257 C 324 256 320 243 325 241 C 341 237 351 230 362 223 L 362 216 C 341 250 144 254 118 216 Z"
        fill="#fff4e2"
      />
      <g fill="#fff8ed" stroke="#ecdbc3" strokeWidth="1">
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i * Math.PI) / 9;
          return (
            <ellipse
              key={i}
              cx={240 + Math.cos(a) * 116}
              cy={299 + Math.sin(a) * 28}
              rx="10"
              ry="7"
              transform={`rotate(${Math.cos(a) * 12} ${240 + Math.cos(a) * 116} ${299 + Math.sin(a) * 28})`}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const cx = 240 + Math.cos(a) * 106;
          const cy = 222 + Math.sin(a) * 28;
          return (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <path d="M -12 2 C -13 -5 -5 -9 0 -13 C 4 -7 13 -7 12 1 C 9 8 -9 9 -12 2" />
              <path d="M -8 2 Q -2 -4 2 -9 M -2 5 Q 6 -1 7 -4" fill="none" stroke="#e8d5bc" />
            </g>
          );
        })}
      </g>
      {[
        [169, 218],
        [314, 217],
        [208, 244],
        [287, 244],
      ].map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${i % 2 ? 12 : -12})`}>
          <path d="M 0 -22 C 19 -22 21 -7 10 5 C 5 13 -2 13 -8 6 C -21 -9 -18 -22 0 -22" fill="#c84a52" />
          <path d="M -12 -17 Q -7 -25 0 -20 Q 6 -28 10 -19 L 3 -16 L 0 -21 L -4 -15 Z" fill="#5c7b51" />
          <g fill="#f5d2a0">
            {[
              [-7, -10],
              [4, -12],
              [-2, -4],
              [8, -3],
              [-7, 0],
              [1, 5],
            ].map(([sx, sy]) => (
              <ellipse key={`${sx},${sy}`} cx={sx} cy={sy} rx="1" ry="1.8" />
            ))}
          </g>
          <path
            d="M -11 -11 Q -13 -16 -6 -18"
            stroke="#f2948a"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
      {[
        [195, 213],
        [292, 215],
        [173, 235],
        [321, 234],
        [264, 246],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="6.5" fill="#65708a" />
          <circle cx={x - 1} cy={y - 2} r="2" fill="#a8afbc" opacity=".5" />
        </g>
      ))}
      {/* Two plain candles: the demo does not assume a specific age. */}
      {[207, 273].map((x) => (
        <g key={x}>
          <path
            d={`M ${x - 8} 218 L ${x - 8} 160 Q ${x - 8} 152 ${x} 150 Q ${x + 8} 152 ${x + 8} 160 L ${x + 8} 218 Z`}
            fill={`url(#${wax})`}
            stroke="#d9a2a0"
            strokeWidth="1"
          />
          <path
            d={`M ${x - 8} 176 Q ${x} 182 ${x + 8} 176 M ${x - 8} 198 Q ${x} 204 ${x + 8} 198`}
            fill="none"
            stroke="#e8c0a8"
            strokeWidth="2"
            opacity=".55"
          />
        </g>
      ))}
      {[207, 273].map((x, i) => (
        <g key={`flame-${x}`}>
          <path
            d={`M ${x} 150 Q ${x - 3} 144 ${x + 1} 138`}
            fill="none"
            stroke="#635044"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {lit ? (
            <>
              <ellipse cx={x} cy="124" rx="27" ry="31" fill={`url(#${glow})`} />
              <path
                d={`M ${x} 138 C ${x - 12} 134 ${x - 8} 121 ${x + 3} 110 C ${x + 2} 121 ${x + 12} 130 ${x} 138`}
                fill="#eeb264"
              />
              <path
                d={`M ${x} 136 C ${x - 5} 132 ${x - 2} 124 ${x + 1} 122 C ${x + 5} 128 ${x + 5} 134 ${x} 136`}
                fill="#fff8cf"
              />
            </>
          ) : (
            celebrating && (
              <path
                d={`M ${x} 134 C ${x + (i ? 8 : -8)} 125 ${x + (i ? -8 : 8)} 120 ${x} 110`}
                stroke="#b6b7a9"
                strokeWidth="2"
                opacity=".38"
                fill="none"
              />
            )
          )}
        </g>
      ))}
    </svg>
  );
}
