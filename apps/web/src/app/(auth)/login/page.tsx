import { Suspense } from "react";
import { LoginScreen } from "@/application/screens/login/LoginScreen";

// The screen's viewmodel reads useSearchParams (the ?next= redirect target),
// which Next requires inside a Suspense boundary for static generation
// (missing-suspense-with-csr-bailout). The boundary must sit above the client
// component, so it lives here in the route shell rather than in the screen.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
