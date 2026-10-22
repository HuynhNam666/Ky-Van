import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kỳ Vân Các — Trang chủ",
  description:
    "Một nước cờ khai sinh nhật nguyệt — Muôn thế trận định đoạt giang sơn.",
};

export default async function TrangChu({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const params = await searchParams;
  const room = Array.isArray(params.room) ? params.room[0] : params.room;

  if (room) {
    redirect(`/ky-dai?room=${encodeURIComponent(room)}`);
  }
  return (
    <iframe
      title="Trang chủ Kỳ Vân Các"
      src="/ky-van-home/index.html"
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
