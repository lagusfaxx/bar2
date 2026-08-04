import { StaffScreen } from "@/components/staff/pos/screen";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffScreen>{children}</StaffScreen>;
}
