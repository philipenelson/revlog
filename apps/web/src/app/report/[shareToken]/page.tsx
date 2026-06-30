import { MechanicPrintoutScreen } from "@/application/screens/mechanic-printout/MechanicPrintoutScreen";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <MechanicPrintoutScreen shareToken={shareToken} />;
}
