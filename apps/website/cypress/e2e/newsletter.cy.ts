describe("Newsletter signup form", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows a validation error for an empty email and does not call the API", () => {
    let subscribeCalled = false;
    cy.intercept("POST", "**/newsletter/subscribe", (req) => {
      subscribeCalled = true;
      req.reply({ statusCode: 201, body: { message: "ok" } });
    });

    cy.get('[data-testid="newsletter-submit"]').click();

    cy.get('[data-testid="newsletter-validation-error"]').should("be.visible");
    cy.get('[data-testid="newsletter-form"]').should("be.visible");
    cy.then(() => {
      expect(subscribeCalled).to.be.false;
    });
  });

  it("shows a validation error for a malformed email and does not call the API", () => {
    let subscribeCalled = false;
    cy.intercept("POST", "**/newsletter/subscribe", (req) => {
      subscribeCalled = true;
      req.reply({ statusCode: 201, body: { message: "ok" } });
    });

    cy.get('[data-testid="newsletter-email-input"]').type("not-an-email");
    cy.get('[data-testid="newsletter-submit"]').click();

    cy.get('[data-testid="newsletter-validation-error"]').should("be.visible");
    cy.then(() => {
      expect(subscribeCalled).to.be.false;
    });
  });

  it("shows a confirmation message and replaces the form on successful subscribe", () => {
    cy.intercept("POST", "**/newsletter/subscribe", {
      statusCode: 201,
      body: { message: "You're subscribed — thanks for following along." },
    }).as("subscribe");

    cy.get('[data-testid="newsletter-email-input"]').type("rider@example.com");
    cy.get('[data-testid="newsletter-submit"]').click();

    cy.wait("@subscribe").its("request.body").should("deep.equal", { email: "rider@example.com" });
    cy.get('[data-testid="newsletter-success"]').should("be.visible");
    cy.get('[data-testid="newsletter-form"]').should("not.be.visible");
  });

  it("shows the same confirmation when resubscribing with an already-subscribed email", () => {
    cy.intercept("POST", "**/newsletter/subscribe", {
      statusCode: 200,
      body: { message: "You're subscribed — thanks for following along." },
    }).as("subscribe");

    cy.get('[data-testid="newsletter-email-input"]').type("rider@example.com");
    cy.get('[data-testid="newsletter-submit"]').click();

    cy.wait("@subscribe");
    cy.get('[data-testid="newsletter-success"]')
      .should("be.visible")
      .and("contain.text", "You're subscribed — thanks for following along.");
  });

  it("shows a server error and preserves the entered email when the request fails", () => {
    cy.intercept("POST", "**/newsletter/subscribe", {
      statusCode: 500,
      body: { error: "Internal server error" },
    }).as("subscribe");

    cy.get('[data-testid="newsletter-email-input"]').type("rider@example.com");
    cy.get('[data-testid="newsletter-submit"]').click();

    cy.wait("@subscribe");
    cy.get('[data-testid="newsletter-server-error"]').should("be.visible");
    cy.get('[data-testid="newsletter-email-input"]').should("have.value", "rider@example.com");
    cy.get('[data-testid="newsletter-form"]').should("be.visible");
  });
});
