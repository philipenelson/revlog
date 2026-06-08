import type { AccountStatus } from "@maintenance-log/domain";

export function routeForAccountStatus(status: AccountStatus): string {
  switch (status) {
    case "ONBOARDING":
      return "/onboarding";
    case "ACTIVE":
      return "/garage";
  }
}
