import type { Metadata } from "next";
// KYVIEN_YOUTUBE_V1
import GlobalYouTubeMusic from "@/components/global-youtube-music";
import "./globals.css";
import LobbyNotifications from "@/components/lobby-notifications";
import PresenceHeartbeat from "@/components/presence-heartbeat";
const title = "Kỳ Viện · Cờ tướng",
  description =
    "Kỳ đài trực tuyến. Giao hữu cùng bằng hữu, luyện cờ với máy và lưu lại từng nước cờ.";
// Link previews (Facebook, Zalo, Telegram...) need an absolute image URL: set NEXT_PUBLIC_SITE_URL to the public address.
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title,
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Kỳ Viện · Cờ tướng trực tuyến",
    description:
      "Mời bạn một ván cờ tướng: phòng online, chat, video call và luyện cờ với máy.",
    type: "website",
    locale: "vi_VN",
    siteName: "Kỳ Viện",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Kỳ Viện — Cờ tướng trực tuyến",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <GlobalYouTubeMusic />
        <PresenceHeartbeat />
        <LobbyNotifications />
        {children}
      </body>
    </html>
  );
}
