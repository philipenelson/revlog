// Proactive mid-session access-token refresh (UC-AUTH-8 / token-refresh.md) and
// the HTTP client's retry policy (ADR 0022).
//
// The proactive scenarios drive the real login form so the session is populated
// and the interceptors are registered *before* /garage mounts — avoiding the
// race where the garage viewmodel fetches on mount. The login issues an
// already-expired access token, so the garage's GET /vehicles is what triggers
// the proactive refresh. The /auth/refresh stub is keyed on whether login has
// happened (not a call counter), so it is immune to React StrictMode's
// double-invoked mount-restore effect in dev.

const VEHICLES_FIXTURE = [
  { id: "the-daily", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, logEntryCount: 12 },
];

const USER = { id: "e2e-user", accountId: "e2e-account", role: "OWNER" };
const ACCOUNT = { id: "e2e-account", status: "ACTIVE" };

const sessionBody = (accessToken: string, accessTokenExpiresAt: string) => ({
  accessToken,
  accessTokenExpiresAt,
  user: USER,
  account: ACCOUNT,
});

const past = () => new Date(Date.now() - 1000).toISOString();
const future = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();

function submitLogin() {
  cy.get('[data-testid="email-input"]').type("e2e@example.com");
  cy.get('[data-testid="password-input"]').type("stubbed-password");
  cy.contains("button", "Continue").click();
}

describe("Proactive token refresh (UC-AUTH-8)", () => {
  it("refreshes an about-to-expire access token before a mid-session request and sends the fresh token", () => {
    cy.setCookie("refreshToken", "e2e-cookie"); // lets the post-login /garage navigation past middleware

    let loggedIn = false;
    cy.intercept("POST", "**/auth/refresh", (req) => {
      // Pre-login: the mount restore must fail so the form shows. Post-login:
      // the proactive refresh succeeds with a brand-new token.
      req.reply(loggedIn
        ? { statusCode: 200, body: sessionBody("fresh-token", future()) }
        : { statusCode: 401, body: { error: "no session" } });
    }).as("refresh");

    cy.intercept("POST", "**/auth/login", (req) => {
      loggedIn = true;
      req.reply({ statusCode: 200, body: sessionBody("stale-token", past()) }); // already-expired access token
    }).as("login");

    cy.intercept("GET", "**/vehicles", (req) => {
      // Proves the proactive refresh ran and attached the *new* token.
      expect(req.headers["authorization"]).to.eq("Bearer fresh-token");
      req.reply({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } });
    }).as("getVehicles");

    cy.visit("/login");
    submitLogin();

    cy.wait("@login");
    cy.wait("@getVehicles");
    cy.location("pathname").should("eq", "/garage");
    cy.contains("The Daily").should("be.visible");
  });

  it("redirects to /login when the proactive refresh fails", () => {
    cy.setCookie("refreshToken", "e2e-cookie");

    // Every refresh fails — the mount restore and the post-login proactive both 401.
    cy.intercept("POST", "**/auth/refresh", { statusCode: 401, body: { error: "Invalid or expired session" } }).as("refresh");

    cy.intercept("POST", "**/auth/login", {
      statusCode: 200,
      body: sessionBody("stale-token", past()),
    }).as("login");

    // After the failed proactive refresh the session is cleared and the request
    // goes out unauthenticated → 401 → the unauthorized interceptor redirects.
    cy.intercept("GET", "**/vehicles", { statusCode: 401, body: { error: "Unauthorized" } }).as("getVehicles");

    cy.visit("/login");
    submitLogin();

    cy.wait("@login");
    cy.location("pathname").should("eq", "/login");
  });
});

describe("HTTP client retry (ADR 0022)", () => {
  it("retries an idempotent GET after a transient network error and renders on success", () => {
    cy.setCookie("refreshToken", "e2e-cookie");

    // Valid (future-expiry) session, so no proactive refresh interferes.
    cy.intercept("POST", "**/auth/refresh", {
      statusCode: 200,
      body: sessionBody("valid-token", future()),
    }).as("refresh");

    let vehiclesCount = 0;
    cy.intercept("GET", "**/vehicles", (req) => {
      vehiclesCount += 1;
      if (vehiclesCount === 1) {
        req.destroy(); // simulate a dropped connection on the first attempt
      } else {
        req.reply({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } });
      }
    }).as("getVehicles");

    cy.visit("/garage");

    cy.contains("The Daily").should("be.visible");
    cy.location("pathname").should("eq", "/garage");
    cy.then(() => expect(vehiclesCount).to.eq(2)); // one failed attempt + one retry
  });
});
