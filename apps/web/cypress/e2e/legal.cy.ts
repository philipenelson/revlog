describe("Terms of Service page", () => {
  it("renders the Terms of Service heading", () => {
    cy.visit("/terms");
    cy.get("h1").should("contain.text", "Terms of Service");
  });

  it("has a back link to /login", () => {
    cy.visit("/terms");
    cy.contains("Back to sign in").should("have.attr", "href", "/login");
  });

  it("footer links to Privacy Policy and Cookie Policy", () => {
    cy.visit("/terms");
    cy.contains("Privacy Policy").should("have.attr", "href", "/privacy");
    cy.contains("Cookie Policy").should("have.attr", "href", "/cookies");
  });
});

describe("Privacy Policy page", () => {
  it("renders the Privacy Policy heading", () => {
    cy.visit("/privacy");
    cy.get("h1").should("contain.text", "Privacy Policy");
  });

  it("has a back link to /login", () => {
    cy.visit("/privacy");
    cy.contains("Back to sign in").should("have.attr", "href", "/login");
  });

  it("footer links to Terms of Service and Cookie Policy", () => {
    cy.visit("/privacy");
    cy.contains("Terms of Service").should("have.attr", "href", "/terms");
    cy.contains("Cookie Policy").should("have.attr", "href", "/cookies");
  });
});

describe("Cookie Policy page", () => {
  it("renders the Cookie Policy heading", () => {
    cy.visit("/cookies");
    cy.get("h1").should("contain.text", "Cookie Policy");
  });

  it("has a back link to /login", () => {
    cy.visit("/cookies");
    cy.contains("Back to sign in").should("have.attr", "href", "/login");
  });
});

describe("Login footer — legal links", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("Terms of Service link navigates to /terms", () => {
    cy.contains("Terms of Service").click();
    cy.location("pathname").should("eq", "/terms");
  });

  it("Privacy Policy link navigates to /privacy", () => {
    cy.contains("Privacy Policy").click();
    cy.location("pathname").should("eq", "/privacy");
  });
});

describe("Cookie consent notice", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it("is visible on first visit", () => {
    cy.visit("/login");
    cy.get('[data-testid="cookie-consent"]').should("be.visible");
  });

  it("is dismissed by clicking Got it and does not reappear", () => {
    cy.visit("/login");
    cy.get('[data-testid="cookie-consent"]').should("be.visible");
    cy.get('[data-testid="cookie-consent-dismiss"]').click();
    cy.get('[data-testid="cookie-consent"]').should("not.exist");

    // Navigate away and back — should not reappear
    cy.visit("/terms");
    cy.visit("/login");
    cy.get('[data-testid="cookie-consent"]').should("not.exist");
  });

  it("Learn more links to /cookies", () => {
    cy.visit("/login");
    cy.get('[data-testid="cookie-consent"]').within(() => {
      cy.contains("Learn more").should("have.attr", "href", "/cookies");
    });
  });
});
