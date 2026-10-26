"use client";
import { names, type Board } from "@/lib/chess";

type Props = {
  board: Board;
  selected: number | null;
  targets: number[];
  last: { from: number; to: number } | null;
  hintFrom: number | null;
  hintTo: number | null;
  checked: number | null;
  disabled?: boolean;
  onSquare: (index: number) => void;
};

// Bàn cờ tương tác cho Phá Thế Sát Cục. Đỏ ở phía dưới, ô đánh số 0..89 giống lib/chess.ts.
export default function PuzzleBoard({
  board,
  selected,
  targets,
  last,
  hintFrom,
  hintTo,
  checked,
  disabled,
  onSquare,
}: Props) {
  const at = (i: number) => ({ x: 50 + (i % 9) * 100, y: 50 + Math.floor(i / 9) * 100 });
  return (
    <svg
      className="pz-board"
      viewBox="0 0 900 1000"
      role="group"
      aria-label="Bàn cờ thế cờ tàn, Đỏ đi trước"
    >
      <defs>
        <linearGradient id="pz-wood" x2="1" y2="1">
          <stop stopColor="#edcf91" />
          <stop offset=".5" stopColor="#d9ab65" />
          <stop offset="1" stopColor="#eccd8b" />
        </linearGradient>
        <radialGradient id="pz-stone">
          <stop stopColor="#fff0c4" />
          <stop offset=".83" stopColor="#e4bd79" />
          <stop offset="1" stopColor="#a9793e" />
        </radialGradient>
      </defs>
      <rect width="900" height="1000" rx="22" fill="url(#pz-wood)" />
      <g stroke="#704b27" strokeWidth="2" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`h${i}`} d={`M50 ${50 + i * 100}H850`} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={`v${i}`}
            d={
              i === 0 || i === 8
                ? `M${50 + i * 100} 50V950`
                : `M${50 + i * 100} 50V450 M${50 + i * 100} 550V950`
            }
          />
        ))}
        <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />
        <rect x="40" y="40" width="820" height="920" strokeWidth="4" />
      </g>
      <text
        x="450"
        y="513"
        textAnchor="middle"
        fill="#795634"
        fontFamily="serif"
        fontSize="30"
        letterSpacing="13"
      >
        SỞ HÀ • HÁN GIỚI
      </text>
      {last &&
        [last.from, last.to].map((i) => (
          <circle key={"l" + i} cx={at(i).x} cy={at(i).y} r="47" fill="#5a763655" stroke="#3c642f" strokeWidth="4" />
        ))}
      {checked !== null && (
        <circle cx={at(checked).x} cy={at(checked).y} r="50" fill="none" stroke="#c72c24" strokeWidth="6" />
      )}
      {hintFrom !== null && (
        <circle cx={at(hintFrom).x} cy={at(hintFrom).y} r="50" fill="none" stroke="#1f7aa8" strokeWidth="6" strokeDasharray="10 7" />
      )}
      {hintTo !== null && (
        <circle cx={at(hintTo).x} cy={at(hintTo).y} r="50" fill="#1f7aa833" stroke="#1f7aa8" strokeWidth="6" strokeDasharray="10 7" />
      )}
      {board.map((p, i) => {
        const { x, y } = at(i);
        const isTarget = targets.includes(i);
        return (
          <g
            key={i}
            className={disabled ? undefined : "pz-sq"}
            onClick={() => !disabled && onSquare(i)}
            role={p ? "img" : undefined}
            aria-label={p ? `${names[p]} ${p[0] === "r" ? "Đỏ" : "Đen"}` : undefined}
          >
            <rect x={x - 50} y={y - 50} width="100" height="100" fill="transparent" />
            {p && (
              <>
                <circle cx={x + 2} cy={y + 5} r="39" fill="#50351655" />
                <circle
                  cx={x}
                  cy={y}
                  r="39"
                  fill="url(#pz-stone)"
                  stroke={selected === i ? "#1f7aa8" : "#70471e"}
                  strokeWidth={selected === i ? 7 : 3}
                />
                <circle cx={x} cy={y} r="31" fill="none" stroke={p[0] === "r" ? "#a72e22" : "#343629"} strokeWidth="1.5" />
                <text
                  x={x}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize="49"
                  fontFamily='"Noto Serif SC","KaiTi","STKaiti","SimSun",serif'
                  fontWeight="bold"
                  fill={p[0] === "r" ? "#a72e22" : "#343629"}
                >
                  {names[p]}
                </text>
              </>
            )}
            {isTarget && (p ? (
              <circle cx={x} cy={y} r="46" fill="none" stroke="#a72e22" strokeWidth="6" strokeDasharray="9 6" />
            ) : (
              <circle cx={x} cy={y} r="14" fill="#2f7b4fcc" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
