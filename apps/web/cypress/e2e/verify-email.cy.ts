describe("Verify-email screen", () => {
  it("shows the waiting state with the emailed address and 24-hour copy", () => {
    cy.visit("/verify-email?email=jordan%40example.com");
    cy.title().should("eq", "Revlog — Verify your email");
    cy.get('[data-testid="verify-waiting"]').within(() => {
      cy.contains("jordan@example.com");
      cy.contains("24 hours");
    });
  });

  it("falls back to generic waiting copy when no email is given", () => {
    cy.visit("/verify-email");
    cy.get('[data-testid="verify-waiting"]').should("contain", "We sent you a verification link.");
  });

  it("shows the error state with an inert resend button for an invalid or expired token", () => {
    cy.visit("/verify-email?token=not-a-real-verification-token-000000");

    cy.get('[data-testid="verify-error"]', { timeout: 10000 }).should("be.visible");
    cy.contains("This link is no longer valid").should("be.visible");
    cy.get('[data-testid="resend-btn"]').should("be.visible").and("contain", "Resend verification email");

    // The error state never redirects on its own
    cy.location("pathname").should("eq", "/verify-email");
  });
});
