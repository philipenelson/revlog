describe("Login / Register screen", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("renders the brand panel and both tab labels", () => {
    cy.contains("Revlog").should("be.visible");
    cy.get('[data-testid="login-tab"]').should("be.visible");
    cy.get('[data-testid="register-tab"]').should("be.visible");
  });

  it("shows login fields by default", () => {
    cy.get('[data-testid="email-input"]').should("exist");
    cy.get('[data-testid="password-input"]').should("exist");
    cy.get('[data-testid="name-input"]').should("not.exist");
  });

  it("switches to register form on tab click", () => {
    cy.get('[data-testid="register-tab"]').click();
    cy.get('[data-testid="name-input"]').should("be.visible");
    cy.get('[data-testid="confirm-password-input"]').should("be.visible");
  });

  it("switches back to login form", () => {
    cy.get('[data-testid="register-tab"]').click();
    cy.get('[data-testid="login-tab"]').click();
    cy.get('[data-testid="name-input"]').should("not.exist");
    cy.get('[data-testid="email-input"]').should("be.visible");
  });
});

// Separate top-level describe — the cookie and POST /auth/refresh stub must be
// in place *before* `cy.visit("/login")` fires, so this can't share the parent
// block's `beforeEach(() => cy.visit("/login"))`.
describe("Login screen — already-authenticated visitor (UC-AUTH-5)", () => {
  it("silently restores the session and routes the visitor onward instead of showing the form", () => {
    cy.setCookie("refreshToken", "e2e-already-signed-in-session");

    cy.intercept("POST", "**/auth/refresh", {
      statusCode: 200,
      body: {
        accessToken: "e2e-restored-access-token",
        user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
        account: { id: "e2e-account", status: "ACTIVE" },
      },
    }).as("refresh");
    cy.intercept("GET", "**/vehicles", { statusCode: 200, body: { vehicles: [] } }).as("getVehicles");

    cy.visit("/login");

    // UC-AUTH-5 (login.md) — an already-authenticated visitor should never see
    // this form; AuthProvider's silent restore on mount (UC-AUTH-7 / ADR 0017)
    // populates the session, and the login screen routes them onward exactly
    // as a fresh sign-in would, by account status (routeForAccountStatus).
    cy.wait("@refresh");
    cy.location("pathname").should("eq", "/garage");
    cy.get('[data-testid="email-input"]').should("not.exist");
  });
});
