import { Suspense } from "react";
import { ResetPasswordScreen } from "@/application/screens/reset-password/ResetPasswordScreen";

// Wrapped in Suspense because the viewmodel reads useSearchParams (the email
// carried from the request screen) — required for static generation. See the
// login route shell for the same pattern.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordScreen />
    </Suspense>
  );
}
