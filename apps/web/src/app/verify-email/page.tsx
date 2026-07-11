import { Suspense } from "react";
import { VerifyEmailScreen } from "@/application/screens/verify-email/VerifyEmailScreen";

// Wrapped in Suspense because the viewmodel reads useSearchParams (the email
// carried from registration) — required for static generation. See the login
// route shell for the same pattern.
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  );
}
