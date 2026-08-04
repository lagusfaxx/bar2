import { StaffScreen } from "@/components/staff/pos/screen";

export default function BarraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffScreen>{children}</StaffScreen>;
}
