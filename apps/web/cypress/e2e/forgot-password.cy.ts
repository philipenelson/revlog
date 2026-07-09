describe("Forgot-password (request code) screen", () => {
  const EMAIL = "jordan@example.com";

  it("shows the email form and the correct page title", () => {
    cy.visit("/forgot-password");
    cy.title().should("eq", "Revlog — Forgot your password");
    cy.get('[data-testid="forgot-password-form"]').within(() => {
      cy.contains("6-digit code");
    });
    cy.get('[data-testid="email-input"]').should("be.visible");
  });

  it("requests a code and advances to the reset screen carrying the email", () => {
    cy.intercept("POST", "**/auth/forgot-password", {
      statusCode: 200,
      body: { message: "If that account exists, a reset code is on its way." },
    }).as("forgot");

    cy.visit("/forgot-password");
    cy.get('[data-testid="email-input"]').type(EMAIL);
    cy.get('[data-testid="forgot-password-btn"]').click();

    cy.wait("@forgot").its("request.body").should("deep.include", { email: EMAIL });
    cy.location("pathname").should("eq", "/reset-password");
    cy.location("search").should("contain", encodeURIComponent(EMAIL));
  });

  it("advances the same way for an unknown email (enumeration-safe)", () => {
    // The server always 200s regardless of whether the email exists.
    cy.intercept("POST", "**/auth/forgot-password", {
      statusCode: 200,
      body: { message: "If that account exists, a reset code is on its way." },
    }).as("forgot");

    cy.visit("/forgot-password");
    cy.get('[data-testid="email-input"]').type("nobody@example.com");
    cy.get('[data-testid="forgot-password-btn"]').click();

    cy.wait("@forgot");
    cy.location("pathname").should("eq", "/reset-password");
  });

  it("blocks submit and makes no request for an invalid email", () => {
    cy.intercept("POST", "**/auth/forgot-password").as("forgot");

    cy.visit("/forgot-password");
    cy.get('[data-testid="email-input"]').type("not-an-email");
    cy.get('[data-testid="forgot-password-btn"]').click();

    cy.location("pathname").should("eq", "/forgot-password");
    cy.get("@forgot.all").should("have.length", 0);
  });

  it("shows a generic error and stays put on a server failure", () => {
    cy.intercept("POST", "**/auth/forgot-password", { statusCode: 500, body: {} }).as("forgot");

    cy.visit("/forgot-password");
    cy.get('[data-testid="email-input"]').type(EMAIL);
    cy.get('[data-testid="forgot-password-btn"]').click();

    cy.wait("@forgot");
    cy.get('[data-testid="forgot-password-error"]').should("be.visible");
    cy.location("pathname").should("eq", "/forgot-password");
  });

  it("links back to the sign-in screen", () => {
    cy.visit("/forgot-password");
    cy.get('[data-testid="back-to-login-link"]').click();
    cy.location("pathname").should("eq", "/login");
  });
});
