const WEB_APP_URL = "http://localhost:3000";

describe("Landing page", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("sets the page title", () => {
    cy.title().should("eq", "Revlog — Your bike's service history, for life.");
  });

  it("renders the sticky nav with section links and the Open web app CTA", () => {
    cy.get('[data-testid="site-header"]').within(() => {
      cy.contains("a", "Features").should("have.attr", "href", "#features");
      cy.contains("a", "Roadmap").should("have.attr", "href", "#roadmap");
      cy.get('[data-testid="open-web-app-nav"]')
        .should("have.attr", "href", WEB_APP_URL)
        .and("contain.text", "Open web app");
    });
  });

  it("renders the hero with headline, both CTAs, and the garage mockup", () => {
    cy.contains("h1", "Every wrench turn,").should("be.visible");
    cy.get('[data-testid="hero-open-web-app"]')
      .should("have.attr", "href", WEB_APP_URL)
      .and("contain.text", "Open the web app");
    cy.get('[data-testid="hero-get-updates"]')
      .should("have.attr", "href", "#newsletter")
      .and("contain.text", "Get updates");
    cy.get('[data-testid="hero-mockup"]').should("be.visible");
  });

  it("'Get updates' scrolls to the newsletter section", () => {
    cy.get('[data-testid="hero-get-updates"]').click();
    cy.location("hash").should("eq", "#newsletter");
    cy.get('[data-testid="newsletter-section"]').should("be.visible");
  });

  it("renders the features grid", () => {
    cy.get("#features").within(() => {
      cy.contains("h2", "Everything your garage needs").should("be.visible");
      cy.contains("Your garage, organized").should("be.visible");
      cy.contains("Seven Log Entry types").should("be.visible");
      cy.contains("Your data belongs to you").should("be.visible");
      cy.contains("Guided onboarding").should("be.visible");
    });
  });

  it("renders the web app showcase with both device-frame mockups", () => {
    cy.contains("h2", "See Revlog in your garage").should("be.visible");
    cy.get('[data-testid="webapp-showcase-mockups"]').children().should("have.length", 2);
  });

  it("renders the mobile app showcase with a Coming soon badge and no app-store links", () => {
    cy.contains("h2", "Revlog, in your pocket").should("be.visible");
    cy.get('[data-testid="mobile-coming-soon-badge"]').should("contain.text", "Coming soon");
    cy.get('[data-testid="mobile-app-mockup"]').should("be.visible");
    cy.get('a[href*="apps.apple.com"], a[href*="play.google.com"]').should("not.exist");
  });

  it("renders the roadmap with planned items", () => {
    cy.get("#roadmap").within(() => {
      cy.contains("h2", "What's next").should("be.visible");
      cy.contains("Fuel tracking").should("be.visible");
      cy.contains("Scheduled maintenance & due reminders").should("be.visible");
      cy.contains("Mechanic printout & exports").should("be.visible");
      cy.contains("Vehicle photos").should("be.visible");
      cy.contains("Mobile apps for iOS & Android").should("be.visible");
      cy.contains("Faster sign-in").should("be.visible");
      cy.get("li").should("have.length", 6);
    });
  });

  it("renders the newsletter form", () => {
    cy.get('[data-testid="newsletter-form"]').should("be.visible");
    cy.get('[data-testid="newsletter-email-input"]').should("be.visible");
    cy.get('[data-testid="newsletter-submit"]').should("contain.text", "Subscribe");
  });

  it("renders the footer with Open web app link and copyright", () => {
    cy.get('[data-testid="site-footer"]').within(() => {
      cy.get('[data-testid="open-web-app-footer"]')
        .should("have.attr", "href", WEB_APP_URL)
        .and("contain.text", "Open web app");
      cy.contains(`© ${new Date().getFullYear()} Revlog`).should("be.visible");
    });
  });
});
