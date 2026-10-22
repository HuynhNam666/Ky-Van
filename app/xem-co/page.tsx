// KYVIEN_SPECTATE_V1
import LiveWatch from "@/components/live-watch";
export default LiveWatch;
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Kỳ Vân Các — Xem cờ",
  description: "Giao diện xem cờ Kỳ Vân Các.",
};
function LegacyXemCo() {
  return (
    <iframe
      title="Kỳ Vân Các — Danh sách ván cờ"
      src="/ky-van-watch/index.html"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100dvh",
        border: 0,
        background: "#0b1215",
        zIndex: 50,
      }}
    />
  );
}
