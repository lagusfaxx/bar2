import { StaffScreen } from "@/components/staff/pos/screen";

export default function CocinaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffScreen>{children}</StaffScreen>;
}
