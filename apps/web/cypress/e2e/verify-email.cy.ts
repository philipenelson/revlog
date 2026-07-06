describe("Verify-email screen", () => {
  const EMAIL = "jordan@example.com";
  const emailQuery = `/verify-email?email=${encodeURIComponent(EMAIL)}`;

  const sessionBody = {
    accessToken: "e2e-verify-access-token",
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    user: { id: "u1", accountId: "a1", role: "OWNER" },
    account: { id: "a1", status: "ONBOARDING" },
  };

  it("shows the code-entry form with the emailed address and 10-minute copy", () => {
    cy.visit(emailQuery);
    cy.title().should("eq", "Revlog — Verify your email");
    cy.get('[data-testid="verify-form"]').within(() => {
      cy.contains(EMAIL);
      cy.contains("10 minutes");
    });
    cy.get('[data-testid="code-input"]').should("be.visible");
  });

  it("falls back to generic copy when no email is given", () => {
    cy.visit("/verify-email");
    cy.get('[data-testid="verify-form"]').should("contain", "We sent you a 6-digit verification code.");
  });

  it("verifies with a correct code and routes onward by account status", () => {
    cy.intercept("POST", "**/auth/verify-email", { statusCode: 200, body: sessionBody }).as("verify");

    cy.visit(emailQuery);
    cy.get('[data-testid="code-input"]').type("123456");
    cy.get('[data-testid="verify-btn"]').click();

    cy.wait("@verify").its("request.body").should("deep.include", { email: EMAIL, code: "123456" });
    // ONBOARDING account routes to the onboarding wizard.
    cy.location("pathname").should("eq", "/onboarding");
  });

  it("shows an inline retry error for a wrong code and stays on the screen", () => {
    cy.intercept("POST", "**/auth/verify-email", { statusCode: 400, body: { error: "invalid_code" } }).as("bad");

    cy.visit(emailQuery);
    cy.get('[data-testid="code-input"]').type("000000");
    cy.get('[data-testid="verify-btn"]').click();

    cy.wait("@bad");
    cy.get('[data-testid="verify-error"]').should("contain", "isn't right");
    cy.location("pathname").should("eq", "/verify-email");
  });

  it("shows an expired-code error that prompts a resend", () => {
    cy.intercept("POST", "**/auth/verify-email", { statusCode: 400, body: { error: "code_expired" } }).as("expired");

    cy.visit(emailQuery);
    cy.get('[data-testid="code-input"]').type("123456");
    cy.get('[data-testid="verify-btn"]').click();

    cy.wait("@expired");
    cy.get('[data-testid="verify-error"]').should("contain", "expired");
    cy.get('[data-testid="resend-btn"]').should("be.visible");
  });

  it("resends a code and shows a confirmation", () => {
    cy.intercept("POST", "**/auth/verify-email/resend", {
      statusCode: 200,
      body: { message: "If that account needs verifying, a new code is on its way." },
    }).as("resend");

    cy.visit(emailQuery);
    cy.get('[data-testid="resend-btn"]').click();
    cy.wait("@resend").its("request.body").should("deep.include", { email: EMAIL });
    cy.get('[data-testid="resend-sent"]').should("be.visible");
  });

  it("blocks submit and makes no request when the code is not 6 digits", () => {
    cy.intercept("POST", "**/auth/verify-email").as("verify");

    cy.visit(emailQuery);
    cy.get('[data-testid="code-input"]').type("12ab");
    cy.get('[data-testid="verify-btn"]').click();

    cy.contains("6-digit code").should("be.visible");
    cy.location("pathname").should("eq", "/verify-email");
    cy.get("@verify.all").should("have.length", 0);
  });
});
