describe("Onboarding wizard", () => {
  beforeEach(() => {
    // Middleware gates this route on the refresh-token cookie's presence only
    // (see ADR 0016) — this spec exercises the wizard's own UI in isolation,
    // not the auth flow that issues a real session (covered by journey.cy.ts).
    cy.setCookie("refreshToken", "e2e-onboarding-session");
    cy.visit("/onboarding");
  });

  it("renders the welcome step with brand and step indicator at step 1", () => {
    cy.contains("Revlog").should("be.visible");
    cy.get('[data-testid="step-welcome"]').should("be.visible");
    cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "1");
    cy.get('[data-testid="add-first-vehicle-btn"]').should("be.visible");
    cy.get('[data-testid="skip-onboarding-btn"]').should("be.visible");
  });

  it("walks the happy path from welcome to the ready summary", () => {
    cy.get('[data-testid="add-first-vehicle-btn"]').click();
    cy.get('[data-testid="step-vehicle"]').should("be.visible");
    cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "2");

    cy.get('[data-testid="nickname-input"]').type("The Daily");
    cy.get('[data-testid="make-input"]').type("Triumph");
    cy.get('[data-testid="model-input"]').type("Street Triple RS");
    cy.get('[data-testid="year-input"]').type("2021");
    cy.get('[data-testid="mileage-input"]').type("14230");
    cy.get('[data-testid="continue-btn"]').click();

    cy.get('[data-testid="step-ready"]').should("be.visible");
    cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "3");
    cy.get('[data-testid="ready-headline"]').should("contain", "The Daily");
    cy.get('[data-testid="vehicle-plate"]').within(() => {
      cy.contains("The Daily");
      cy.contains("Triumph Street Triple RS");
      cy.contains("2021");
      cy.contains("14230 mi");
    });

    cy.get('[data-testid="go-to-garage-btn"]').click();
    cy.location("pathname").should("eq", "/garage");
  });

  it("falls back to the make and model when no nickname is given", () => {
    cy.get('[data-testid="add-first-vehicle-btn"]').click();
    cy.get('[data-testid="make-input"]').type("Triumph");
    cy.get('[data-testid="model-input"]').type("Street Triple RS");
    cy.get('[data-testid="year-input"]').type("2021");
    cy.get('[data-testid="mileage-input"]').type("14230");
    cy.get('[data-testid="continue-btn"]').click();

    cy.get('[data-testid="ready-headline"]').should("contain", "Triumph Street Triple RS");
    cy.get('[data-testid="vehicle-plate"]').within(() => {
      cy.contains("span", "Nickname").parent().contains("strong", "—");
    });
  });

  it("shows a validation error per empty or invalid field and clears it once corrected", () => {
    cy.get('[data-testid="add-first-vehicle-btn"]').click();
    cy.get('[data-testid="continue-btn"]').click();

    cy.get('[data-testid="step-vehicle"]').should("be.visible");
    cy.get('[data-testid="make-input"]')
      .siblings('[role="alert"]')
      .should("contain", "Enter the manufacturer.");
    cy.get('[data-testid="model-input"]')
      .siblings('[role="alert"]')
      .should("contain", "Enter the model.");
    cy.get('[data-testid="year-input"]')
      .siblings('[role="alert"]')
      .should("contain", "Enter a numeric year.");
    cy.contains("Enter the current mileage.").should("be.visible");

    cy.get('[data-testid="make-input"]').type("Triumph");
    cy.get('[data-testid="make-input"]').siblings('[role="alert"]').should("not.exist");
  });

  it("rejects a non-numeric year and mileage", () => {
    cy.get('[data-testid="add-first-vehicle-btn"]').click();
    cy.get('[data-testid="make-input"]').type("Triumph");
    cy.get('[data-testid="model-input"]').type("Street Triple RS");
    cy.get('[data-testid="year-input"]').type("not-a-year");
    cy.get('[data-testid="mileage-input"]').type("lots");
    cy.get('[data-testid="continue-btn"]').click();

    cy.contains("Enter a numeric year.").should("be.visible");
    cy.contains("Enter the current mileage.").should("be.visible");
    cy.get('[data-testid="step-vehicle"]').should("be.visible");
  });

  it("returns to the welcome step via Back without losing the skip option", () => {
    cy.get('[data-testid="add-first-vehicle-btn"]').click();
    cy.get('[data-testid="back-btn"]').click();

    cy.get('[data-testid="step-welcome"]').should("be.visible");
    cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "1");
    cy.get('[data-testid="skip-onboarding-btn"]').should("be.visible");
  });

  it("skips onboarding straight to the garage from the welcome step", () => {
    cy.get('[data-testid="skip-onboarding-btn"]').click();
    cy.location("pathname").should("eq", "/garage");
  });
});
