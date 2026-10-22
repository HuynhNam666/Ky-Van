import SessionGate from "@/components/session-gate";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SessionGate>{children}</SessionGate>;
}
