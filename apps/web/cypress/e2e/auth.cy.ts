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
