describe("Reset-password screen", () => {
  const EMAIL = "jordan@example.com";
  const emailQuery = `/reset-password?email=${encodeURIComponent(EMAIL)}`;
  const NEW_PASSWORD = "BrandNewPass9";

  const sessionBody = {
    accessToken: "e2e-reset-access-token",
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    user: { id: "u1", accountId: "a1", role: "OWNER" },
    account: { id: "a1", status: "ONBOARDING" },
  };

  function fillForm(code: string, newPassword: string, confirmPassword: string) {
    cy.get('[data-testid="code-input"]').type(code);
    cy.get('[data-testid="new-password-input"]').type(newPassword);
    cy.get('[data-testid="confirm-password-input"]').type(confirmPassword);
  }

  it("shows the reset form with the emailed address, title, and 10-minute copy", () => {
    cy.visit(emailQuery);
    cy.title().should("eq", "Revlog — Reset your password");
    cy.get('[data-testid="reset-form"]').within(() => {
      cy.contains(EMAIL);
      cy.contains("10 minutes");
    });
    cy.get('[data-testid="code-input"]').should("be.visible");
  });

  it("falls back to generic copy when no email is given", () => {
    cy.visit("/reset-password");
    cy.get('[data-testid="reset-form"]').should("contain", "We sent you a 6-digit reset code.");
  });

  it("resets with a correct code + new password and routes onward by account status", () => {
    cy.intercept("POST", "**/auth/reset-password", { statusCode: 200, body: sessionBody }).as("reset");

    cy.visit(emailQuery);
    fillForm("654321", NEW_PASSWORD, NEW_PASSWORD);
    cy.get('[data-testid="reset-btn"]').click();

    cy.wait("@reset").its("request.body").should("deep.include", {
      email: EMAIL,
      code: "654321",
      newPassword: NEW_PASSWORD,
    });
    // ONBOARDING account routes to the onboarding wizard.
    cy.location("pathname").should("eq", "/onboarding");
  });

  it("shows an inline retry error for a wrong code and stays on the screen", () => {
    cy.intercept("POST", "**/auth/reset-password", { statusCode: 400, body: { error: "invalid_code" } }).as("bad");

    cy.visit(emailQuery);
    fillForm("000000", NEW_PASSWORD, NEW_PASSWORD);
    cy.get('[data-testid="reset-btn"]').click();

    cy.wait("@bad");
    cy.get('[data-testid="reset-error"]').should("contain", "isn't right");
    cy.location("pathname").should("eq", "/reset-password");
  });

  it("shows an expired-code error that prompts a resend", () => {
    cy.intercept("POST", "**/auth/reset-password", { statusCode: 400, body: { error: "code_expired" } }).as("expired");

    cy.visit(emailQuery);
    fillForm("654321", NEW_PASSWORD, NEW_PASSWORD);
    cy.get('[data-testid="reset-btn"]').click();

    cy.wait("@expired");
    cy.get('[data-testid="reset-error"]').should("contain", "expired");
    cy.get('[data-testid="resend-btn"]').should("be.visible");
  });

  it("blocks submit and makes no request when the passwords do not match", () => {
    cy.intercept("POST", "**/auth/reset-password").as("reset");

    cy.visit(emailQuery);
    fillForm("654321", NEW_PASSWORD, "DifferentPass9");
    cy.get('[data-testid="reset-btn"]').click();

    cy.get('[data-testid="confirm-password-error"]').should("contain", "Passwords do not match");
    cy.location("pathname").should("eq", "/reset-password");
    cy.get("@reset.all").should("have.length", 0);
  });

  it("blocks submit and makes no request when the new password is too weak", () => {
    cy.intercept("POST", "**/auth/reset-password").as("reset");

    cy.visit(emailQuery);
    fillForm("654321", "short", "short");
    cy.get('[data-testid="reset-btn"]').click();

    cy.location("pathname").should("eq", "/reset-password");
    cy.get("@reset.all").should("have.length", 0);
  });

  it("resends a code and shows a confirmation", () => {
    cy.intercept("POST", "**/auth/forgot-password", {
      statusCode: 200,
      body: { message: "If that account exists, a reset code is on its way." },
    }).as("resend");

    cy.visit(emailQuery);
    cy.get('[data-testid="resend-btn"]').click();
    cy.wait("@resend").its("request.body").should("deep.include", { email: EMAIL });
    cy.get('[data-testid="resend-sent"]').should("be.visible");
  });
});
