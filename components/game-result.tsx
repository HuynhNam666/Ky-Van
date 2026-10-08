"use client";

import { useState, type CSSProperties } from "react";
import {
  Trophy,
  Swords,
  Handshake,
  Download,
  ArrowRight,
  Sparkles,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "./game-result.css";

type Props = {
  result: string;
  winner?: "r" | "b" | null;
  mySide: "r" | "b";
  mode: string;
  moves: number;
  roomCode?: string;
  onNewGame: () => void;
  onExport: () => void;
};

export default function GameResult({
  result,
  winner,
  mySide,
  mode,
  moves,
  roomCode,
  onNewGame,
  onExport,
}: Props) {
  const [open, setOpen] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);

  // Giữ nguyên cách xác định kết quả của phiên bản cũ.
  const winningSide = roomCode
    ? winner
    : result.startsWith("Đỏ thắng")
      ? "r"
      : result.startsWith("Đen thắng")
        ? "b"
        : null;

  const outcome = !winningSide
    ? "draw"
    : mode === "local" || winningSide === mySide
      ? "win"
      : "loss";

  const title =
    outcome === "draw"
      ? "KỲ PHÙNG ĐỊCH THỦ"
      : mode === "local"
        ? `QUÂN ${winningSide === "r" ? "ĐỎ" : "ĐEN"} CHIẾN THẮNG`
        : outcome === "win"
          ? "CHIẾN THẮNG"
          : "HẸN VÁN CỜ SAU";

  const subtitle =
    outcome === "win"
      ? "Một nước cờ hay, một chiến thắng xứng đáng."
      : outcome === "loss"
        ? "Thắng không kiêu, bại không nản. Kỳ đạo còn dài."
        : "Một ván cân tài, thêm một người tri kỷ.";

  const Icon =
    outcome === "win" ? Trophy : outcome === "loss" ? Swords : Handshake;

  const seal =
    outcome === "win"
      ? "VINH QUANG KỲ ĐẠO"
      : outcome === "loss"
        ? "BẢN LĨNH KỲ THỦ"
        : "TRI KỶ TRÊN BÀN CỜ";

  function reopenResult() {
    setAnimationKey((value) => value + 1);
    setOpen(true);
  }

  return (
    <>
      <button type="button" className="kv-result-reopen" onClick={reopenResult}>
        <Sparkles size={15} />
        Xem kết quả ván cờ
        <ArrowRight size={15} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`kv-result kv-premium kv-result--${outcome}`}>
          <div
            key={animationKey}
            className="kv-premium-scene"
            aria-hidden="true"
          >
            <div className="kv-premium-aura" />
            <div className="kv-premium-mist kv-premium-mist-one" />
            <div className="kv-premium-mist kv-premium-mist-two" />
            <div className="kv-premium-grid" />
            <div className="kv-premium-sweep" />

            <div className="kv-premium-particles">
              {Array.from(
                { length: outcome === "win" ? 32 : 16 },
                (_, index) => (
                  <i
                    key={index}
                    className={
                      outcome === "win"
                        ? "kv-gold-particle"
                        : "kv-soft-particle"
                    }
                    style={
                      {
                        "--particle-x": `${(index * 37 + 7) % 100}%`,
                        "--particle-delay": `${(index % 8) * 0.18}s`,
                        "--particle-duration": `${3.2 + (index % 5) * 0.4}s`,
                        "--particle-drift": `${((index * 19) % 100) - 50}px`,
                        "--particle-size": `${2 + (index % 4)}px`,
                      } as CSSProperties
                    }
                  />
                ),
              )}
            </div>

            <span className="kv-premium-corner kv-corner-tl" />
            <span className="kv-premium-corner kv-corner-tr" />
            <span className="kv-premium-corner kv-corner-bl" />
            <span className="kv-premium-corner kv-corner-br" />
          </div>

          <div className="kv-result-content">
            <div className="kv-result-eyebrow">
              <span className="kv-premium-brand">KỲ VIỆN</span>
              <span className="kv-premium-diamond" />
              VÁN CỜ KHÉP LẠI
            </div>

            <div className="kv-premium-emblem" aria-hidden="true">
              <div className="kv-premium-halo" />

              <svg
                className="kv-premium-orbit"
                viewBox="0 0 200 200"
                fill="none"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="91"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  opacity="0.35"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="83"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2 11"
                  opacity="0.65"
                />
                <path d="M100 4L105 12L100 20L95 12Z" fill="currentColor" />
                <path
                  d="M100 180L105 188L100 196L95 188Z"
                  fill="currentColor"
                />
                <path d="M4 100L12 95L20 100L12 105Z" fill="currentColor" />
                <path
                  d="M180 100L188 95L196 100L188 105Z"
                  fill="currentColor"
                />
              </svg>

              <svg
                className="kv-premium-laurel"
                viewBox="0 0 200 200"
                fill="none"
              >
                <path
                  d="M71 165C25 145 22 87 55 45"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M129 165C175 145 178 87 145 45"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />

                {[0, 1, 2, 3, 4].map((index) => (
                  <g key={index}>
                    <ellipse
                      cx={37 + index * 3}
                      cy={78 + index * 15}
                      rx="4"
                      ry="10"
                      transform={`rotate(${-40 - index * 7} ${
                        37 + index * 3
                      } ${78 + index * 15})`}
                      fill="currentColor"
                      opacity={0.35 + index * 0.1}
                    />
                    <ellipse
                      cx={163 - index * 3}
                      cy={78 + index * 15}
                      rx="4"
                      ry="10"
                      transform={`rotate(${40 + index * 7} ${
                        163 - index * 3
                      } ${78 + index * 15})`}
                      fill="currentColor"
                      opacity={0.35 + index * 0.1}
                    />
                  </g>
                ))}
              </svg>

              <div className="kv-premium-medallion">
                <div className="kv-premium-medallion-inner">
                  <Icon
                    className="kv-premium-main-icon"
                    size={46}
                    strokeWidth={1.35}
                  />
                </div>
                <span className="kv-premium-medallion-shine" />
              </div>

              <span className="kv-premium-star kv-premium-star-one">✦</span>
              <span className="kv-premium-star kv-premium-star-two">✧</span>
            </div>

            <div className="kv-premium-seal">{seal}</div>

            <DialogHeader className="kv-result-heading">
              <DialogTitle className="kv-result-title">{title}</DialogTitle>

              <DialogDescription className="kv-result-subtitle">
                {subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="kv-result-divider" aria-hidden="true">
              <span />
              <span className="kv-premium-divider-mark">弈</span>
              <span />
            </div>

            <p className="kv-result-reason">{result}</p>

            <div className="kv-result-stats">
              <div>
                <strong>{moves}</strong>
                <span>NƯỚC ĐI</span>
              </div>

              <div>
                <strong>
                  {roomCode || (mode === "ai" ? "Luyện tập" : "Giao hữu")}
                </strong>
                <span>{roomCode ? "MÃ PHÒNG" : "CHẾ ĐỘ"}</span>
              </div>
            </div>

            <button
              type="button"
              className="kv-result-primary"
              onClick={() => {
                setOpen(false);
                onNewGame();
              }}
            >
              <Swords size={18} />
              <span>{roomCode ? "Tạo phòng mới" : "Khai cuộc mới"}</span>
              <ArrowRight size={18} />
            </button>

            <div className="kv-result-actions">
              <button type="button" onClick={() => setOpen(false)}>
                <Eye size={15} />
                Xem lại bàn cờ
              </button>

              <button type="button" onClick={onExport}>
                <Download size={15} />
                Xuất biên bản
              </button>
            </div>

            <p className="kv-result-footnote">
              GIỮ LỄ TRÊN BÀN CỜ · GIỮ TÌNH NGOÀI CUỘC
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        /* Chỉ áp dụng cho hộp kết quả có class kv-premium. */
        .kv-result.kv-premium {
          --premium-accent: #e9c779;
          --premium-bright: #fff2c9;
          --premium-muted: #ac976a;
          --premium-glow: rgba(222, 177, 77, 0.2);
          --premium-bg: #171e19;
          --premium-button-text: #302411;

          width: min(92vw, 470px) !important;
          max-width: 470px !important;
          max-height: calc(100dvh - 28px) !important;
          display: block !important;
          padding: 0 !important;
          gap: 0 !important;
          overflow-x: hidden;
          overflow-y: auto;
          border: 1px solid #8b754b !important;
          border-radius: 20px !important;
          color: #f3ead5 !important;
          background:
            radial-gradient(
              ellipse at 50% 5%,
              var(--premium-glow),
              transparent 58%
            ),
            var(--premium-bg) !important;
          box-shadow:
            0 30px 110px #000b,
            0 0 65px var(--premium-glow),
            inset 0 0 0 4px #ffffff03 !important;
          scrollbar-width: thin;
          scrollbar-color: var(--premium-muted) var(--premium-bg);
          isolation: isolate;
        }

        .kv-result.kv-premium.kv-result--loss {
          --premium-accent: #adc4d0;
          --premium-bright: #e6f2f7;
          --premium-muted: #7e96a3;
          --premium-glow: rgba(115, 157, 180, 0.17);
          --premium-bg: #192329;
          --premium-button-text: #17252d;
          border-color: #617985 !important;
        }

        .kv-result.kv-premium.kv-result--draw {
          --premium-accent: #b8d5b1;
          --premium-bright: #edf6df;
          --premium-muted: #849f7c;
          --premium-glow: rgba(148, 191, 139, 0.18);
          --premium-bg: #1a251f;
          --premium-button-text: #23331f;
          border-color: #718d6e !important;
        }

        .kv-premium .kv-premium-scene {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: inherit;
          pointer-events: none;
          z-index: 0;
        }

        .kv-premium .kv-premium-aura {
          position: absolute;
          width: 360px;
          height: 360px;
          left: calc(50% - 180px);
          top: -55px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            var(--premium-glow),
            transparent 68%
          );
          animation: kvp-aura 4s ease-in-out 3;
        }

        .kv-premium .kv-premium-mist {
          position: absolute;
          width: 340px;
          height: 120px;
          border-radius: 50%;
          background: var(--premium-glow);
          filter: blur(42px);
          opacity: 0.4;
          animation: kvp-mist 8s ease-in-out 2 alternate;
        }

        .kv-premium .kv-premium-mist-one {
          top: 160px;
          left: -160px;
        }

        .kv-premium .kv-premium-mist-two {
          top: 290px;
          right: -170px;
          animation-delay: -4s;
        }

        .kv-premium .kv-premium-grid {
          position: absolute;
          inset: 0;
          opacity: 0.06;
          background-image:
            linear-gradient(var(--premium-accent) 1px, transparent 1px),
            linear-gradient(90deg, var(--premium-accent) 1px, transparent 1px);
          background-size: 38px 38px;
          mask-image: linear-gradient(#000, transparent 60%);
        }

        .kv-premium .kv-premium-sweep {
          position: absolute;
          inset: -50%;
          background: linear-gradient(
            115deg,
            transparent 42%,
            #ffffff06 49%,
            #ffffff0d 50%,
            transparent 58%
          );
          animation: kvp-sweep 2.4s 0.3s ease-out both;
        }

        .kv-premium .kv-premium-corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: var(--premium-accent);
          border-style: solid;
          opacity: 0.45;
        }

        .kv-premium .kv-corner-tl {
          top: 12px;
          left: 12px;
          border-width: 1px 0 0 1px;
          border-radius: 5px 0 0;
        }

        .kv-premium .kv-corner-tr {
          top: 12px;
          right: 12px;
          border-width: 1px 1px 0 0;
          border-radius: 0 5px 0 0;
        }

        .kv-premium .kv-corner-bl {
          bottom: 12px;
          left: 12px;
          border-width: 0 0 1px 1px;
          border-radius: 0 0 0 5px;
        }

        .kv-premium .kv-corner-br {
          bottom: 12px;
          right: 12px;
          border-width: 0 1px 1px 0;
          border-radius: 0 0 5px;
        }

        .kv-premium .kv-result-content {
          position: relative;
          z-index: 1;
          padding: 26px 28px 18px;
          text-align: center;
        }

        .kv-premium .kv-result-eyebrow {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          margin: 0 20px 8px;
          font:
            9px Arial,
            sans-serif;
          letter-spacing: 1.8px;
          line-height: 1.6;
          color: var(--premium-muted);
        }

        .kv-premium .kv-premium-brand {
          color: var(--premium-accent);
          font-weight: 700;
        }

        .kv-premium .kv-premium-diamond {
          width: 4px;
          height: 4px;
          background: var(--premium-accent);
          transform: rotate(45deg);
          flex-shrink: 0;
        }

        .kv-premium .kv-premium-emblem {
          position: relative;
          display: grid;
          place-items: center;
          width: 168px;
          height: 168px;
          margin: 2px auto 0;
          color: var(--premium-accent);
          animation: kvp-emblem-in 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .kv-premium .kv-premium-halo {
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            var(--premium-glow),
            transparent 70%
          );
          box-shadow: 0 0 35px var(--premium-glow);
          animation: kvp-aura 3.5s ease-in-out 3;
        }

        .kv-premium .kv-premium-orbit,
        .kv-premium .kv-premium-laurel {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .kv-premium .kv-premium-orbit {
          animation: kvp-orbit 24s linear 1;
        }

        .kv-premium .kv-premium-laurel {
          opacity: 0.8;
        }

        .kv-premium.kv-result--loss .kv-premium-laurel {
          opacity: 0.35;
        }

        .kv-premium .kv-premium-medallion {
          position: relative;
          width: 100px;
          height: 100px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 50%;
          border: 1px solid var(--premium-accent);
          background: linear-gradient(
            145deg,
            var(--premium-bright),
            var(--premium-muted) 30%,
            var(--premium-accent) 52%,
            var(--premium-muted) 78%,
            var(--premium-bright)
          );
          box-shadow:
            0 6px 0 #0004,
            0 12px 25px #0005,
            0 0 32px var(--premium-glow),
            inset 0 1px 1px #fff8;
          animation: kvp-float 4s 0.8s ease-in-out 3;
        }

        .kv-premium .kv-premium-medallion-inner {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1px solid var(--premium-accent);
          background:
            radial-gradient(
              circle at 35% 20%,
              var(--premium-glow),
              transparent 80%
            ),
            var(--premium-bg);
          box-shadow:
            inset 0 0 0 4px #ffffff04,
            inset 0 3px 10px #0007;
        }

        .kv-premium .kv-premium-main-icon {
          color: var(--premium-bright);
          filter: drop-shadow(0 2px 4px #0006);
        }

        .kv-premium .kv-premium-medallion-shine {
          position: absolute;
          inset: -30%;
          background: linear-gradient(
            115deg,
            transparent 38%,
            #ffffff03 43%,
            #ffffff35 50%,
            transparent 59%
          );
          animation: kvp-sweep 2.8s 0.7s ease-in-out 2 both;
        }

        .kv-premium .kv-premium-star {
          position: absolute;
          color: var(--premium-bright);
          text-shadow: 0 0 12px var(--premium-accent);
          animation: kvp-twinkle 2.5s ease-in-out 4;
        }

        .kv-premium .kv-premium-star-one {
          top: 30px;
          right: 26px;
          font-size: 20px;
        }

        .kv-premium .kv-premium-star-two {
          bottom: 30px;
          left: 22px;
          font-size: 15px;
          animation-delay: 0.7s;
        }

        .kv-premium .kv-premium-seal {
          width: fit-content;
          margin: 2px auto 12px;
          border: 1px solid var(--premium-muted);
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 8px;
          line-height: 1.4;
          letter-spacing: 2px;
          color: var(--premium-accent);
          background: #0002;
        }

        .kv-premium .kv-result-heading {
          display: block !important;
          text-align: center !important;
        }

        .kv-premium .kv-result-title {
          margin: 0 !important;
          font-family: Georgia, "Times New Roman", serif !important;
          font-size: clamp(24px, 5.8vw, 34px) !important;
          font-weight: 700 !important;
          line-height: 1.2 !important;
          letter-spacing: 1px;
          text-wrap: balance;
          color: var(--premium-bright) !important;
          background: linear-gradient(
            110deg,
            var(--premium-muted),
            var(--premium-bright) 35%,
            var(--premium-accent) 65%,
            var(--premium-bright)
          );
          background-size: 200% auto;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation:
            kvp-rise 0.7s 0.12s both,
            kvp-gold-text 5s 1s ease-in-out 2;
        }

        .kv-premium .kv-result-subtitle {
          max-width: 330px;
          margin: 10px auto 0 !important;
          color: #b9c1b8 !important;
          font-size: 13px !important;
          line-height: 1.65 !important;
          text-wrap: balance;
          animation: kvp-rise 0.7s 0.2s both;
        }

        .kv-premium .kv-result-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 13px 0 9px;
          color: var(--premium-accent);
          opacity: 0.7;
        }

        .kv-premium .kv-result-divider > span:not(.kv-premium-divider-mark) {
          width: 62px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--premium-accent)
          );
        }

        .kv-premium .kv-result-divider > span:last-child {
          transform: rotate(180deg);
        }

        .kv-premium .kv-result-divider .kv-premium-divider-mark {
          width: auto;
          height: auto;
          background: none;
          font: 19px serif;
        }

        .kv-premium .kv-result-reason {
          margin: 0 auto 15px;
          max-width: 340px;
          color: #e0dece;
          font-size: 12px;
          line-height: 1.6;
          text-wrap: balance;
        }

        .kv-premium .kv-result-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          margin: 0 0 16px;
          padding: 12px 8px;
          border: 1px solid #ffffff12;
          border-radius: 10px;
          background: linear-gradient(120deg, #ffffff04, #0002);
          box-shadow: inset 0 1px #ffffff03;
        }

        .kv-premium .kv-result-stats > div + div {
          border-left: 1px solid #ffffff13;
        }

        .kv-premium .kv-result-stats strong {
          display: block;
          color: var(--premium-bright);
          font:
            20px Georgia,
            serif;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .kv-premium .kv-result-stats span {
          display: block;
          margin-top: 5px;
          color: #95a28f;
          font-size: 8px;
          letter-spacing: 1.7px;
        }

        .kv-premium .kv-result-primary {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 46px;
          gap: 12px;
          padding: 10px 16px;
          overflow: hidden;
          border: 1px solid var(--premium-accent) !important;
          border-radius: 8px;
          color: var(--premium-button-text) !important;
          background: linear-gradient(
            110deg,
            var(--premium-accent),
            var(--premium-bright),
            var(--premium-accent)
          ) !important;
          box-shadow:
            inset 0 1px #fff8,
            0 5px 18px #0003;
          font-size: 14px;
          font-weight: 700;
          transition:
            filter 0.2s,
            box-shadow 0.2s;
        }

        .kv-premium .kv-result-primary span {
          flex: 1;
        }

        .kv-premium .kv-result-primary > svg {
          margin: 0 !important;
        }

        .kv-premium .kv-result-primary:hover {
          filter: brightness(1.08);
          box-shadow: 0 5px 25px var(--premium-glow);
        }

        .kv-premium .kv-result-actions {
          display: flex;
          justify-content: center;
          gap: 18px;
          margin: 8px 0 0;
        }

        .kv-premium .kv-result-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 38px;
          padding: 5px;
          border: 0;
          background: transparent;
          color: #c6cbbf;
          font-size: 12px;
        }

        .kv-premium .kv-result-actions button:hover {
          color: var(--premium-bright);
        }

        .kv-premium .kv-result-footnote {
          margin: 10px 0 0;
          color: #788778;
          font-size: 7px;
          line-height: 1.7;
          letter-spacing: 1.3px;
        }

        .kv-premium > [data-slot="dialog-close"] {
          z-index: 5;
          top: 15px;
          right: 15px;
          color: var(--premium-accent);
        }

        .kv-premium .kv-premium-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .kv-premium .kv-premium-particles i {
          position: absolute;
          left: var(--particle-x);
          top: -15px;
          width: var(--particle-size);
          height: var(--particle-size);
          background: var(--premium-accent);
          opacity: 0;
          animation: kvp-particle-fall var(--particle-duration)
            var(--particle-delay) ease-in 2 both;
        }

        .kv-premium .kv-premium-particles .kv-gold-particle {
          height: calc(var(--particle-size) * 1.7);
          border-radius: 1px;
          box-shadow: 0 0 5px var(--premium-glow);
        }

        .kv-premium .kv-premium-particles .kv-soft-particle {
          border-radius: 50%;
          box-shadow: 0 0 7px var(--premium-accent);
          animation-name: kvp-particle-drift;
        }

        @keyframes kvp-emblem-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.78);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes kvp-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kvp-aura {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.94);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }

        @keyframes kvp-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes kvp-orbit {
          to {
            transform: rotate(180deg);
          }
        }

        @keyframes kvp-twinkle {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes kvp-mist {
          from {
            transform: translateX(-25px) scale(0.9);
          }
          to {
            transform: translateX(55px) scale(1.15);
          }
        }

        @keyframes kvp-sweep {
          from {
            transform: translateX(-110%);
          }
          to {
            transform: translateX(110%);
          }
        }

        @keyframes kvp-gold-text {
          0%,
          100% {
            background-position: 0% center;
          }
          50% {
            background-position: 100% center;
          }
        }

        @keyframes kvp-particle-fall {
          0% {
            opacity: 0;
            transform: translate(0, -15px) rotate(0);
          }
          15% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.55;
          }
          100% {
            opacity: 0;
            transform: translate(var(--particle-drift), 680px) rotate(430deg);
          }
        }

        @keyframes kvp-particle-drift {
          0% {
            opacity: 0;
            transform: translate(0, 520px) scale(0.6);
          }
          25% {
            opacity: 0.5;
          }
          75% {
            opacity: 0.35;
          }
          100% {
            opacity: 0;
            transform: translate(var(--particle-drift), 40px) scale(1);
          }
        }

        @media (max-width: 480px) {
          .kv-premium .kv-result-content {
            padding: 25px 20px 16px;
          }

          .kv-premium .kv-result-eyebrow {
            font-size: 8px;
            letter-spacing: 1.1px;
          }

          .kv-premium .kv-premium-emblem {
            width: 145px;
            height: 145px;
          }

          .kv-premium .kv-premium-medallion {
            width: 88px;
            height: 88px;
          }

          .kv-premium .kv-premium-medallion-inner {
            width: 74px;
            height: 74px;
          }

          .kv-premium .kv-premium-main-icon {
            width: 40px;
            height: 40px;
          }

          .kv-premium .kv-result-actions {
            gap: 12px;
          }

          .kv-premium .kv-result-footnote {
            letter-spacing: 0.8px;
          }
        }

        @media (max-height: 740px) {
          .kv-premium .kv-result-content {
            padding-top: 20px;
            padding-bottom: 14px;
          }

          .kv-premium .kv-premium-emblem {
            width: 125px;
            height: 125px;
          }

          .kv-premium .kv-premium-medallion {
            width: 82px;
            height: 82px;
          }

          .kv-premium .kv-premium-medallion-inner {
            width: 69px;
            height: 69px;
          }

          .kv-premium .kv-premium-main-icon {
            width: 36px;
            height: 36px;
          }

          .kv-premium .kv-result-title {
            font-size: 27px !important;
          }

          .kv-premium .kv-premium-seal {
            margin-bottom: 9px;
          }

          .kv-premium .kv-result-divider {
            margin: 9px 0 7px;
          }

          .kv-premium .kv-result-reason {
            margin-bottom: 11px;
          }

          .kv-premium .kv-result-stats {
            padding: 10px 8px;
            margin-bottom: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kv-result.kv-premium,
          .kv-result.kv-premium *,
          .kv-result.kv-premium *::before,
          .kv-result.kv-premium *::after {
            animation: none !important;
            transition: none !important;
          }

          .kv-premium .kv-premium-particles,
          .kv-premium .kv-premium-sweep,
          .kv-premium .kv-premium-medallion-shine {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
