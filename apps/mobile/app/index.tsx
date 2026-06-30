import { Redirect } from 'expo-router';

// Unconditional redirect for now: AuthProvider / routeForAuthState don't
// exist yet (tracked in docs/milestones/v1.md — Navigation). Once they
// land, this becomes a real auth gate resolving to /garage, /welcome, or
// /onboarding — see ADR 0030 and docs/specs/mobile-app/navigation.md.
export default function IndexPage() {
  return <Redirect href="/welcome" />;
}
