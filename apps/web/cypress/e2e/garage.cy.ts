describe("Garage screen", () => {
  beforeEach(() => {
    cy.visit("/garage");
  });

  it("renders the top bar with brand, add-vehicle action, and avatar", () => {
    cy.contains("Revlog").should("be.visible");
    cy.get('[data-testid="topbar-add-vehicle-btn"]').should("be.visible").and("contain", "Add vehicle");
    cy.get('[data-testid="avatar"]').should("be.visible").and("contain", "JR");
  });

  it("renders the populated garage's header with vehicle count and sort sub-line", () => {
    cy.get('[data-testid="page-title"]').should("contain", "3 vehicles");
    cy.get('[data-testid="page-sub"]').should("contain", "Sorted by most recently logged");
  });

  it("renders one card per vehicle with its display name, meta, and stats", () => {
    cy.get('[data-testid="vehicle-card"]').should("have.length", 3);

    cy.get('[data-testid="vehicle-card"][data-vehicle-id="the-daily"]').within(() => {
      cy.contains("h2", "The Daily");
      cy.contains("Triumph · Street Triple RS · 2021");
      cy.contains("14,230");
      cy.contains("mi");
      cy.contains("Odometer");
      cy.contains("12");
      cy.contains("Log entries");
      cy.contains("View service history");
    });

    cy.get('[data-testid="vehicle-card"][data-vehicle-id="sunday-bike"]').within(() => {
      cy.contains("h2", "Sunday Bike");
      cy.contains("Ducati · Scrambler Icon · 2019");
      cy.contains("8,402");
    });
  });

  it("shows 'No entries yet' for a vehicle with zero log entries", () => {
    cy.get('[data-testid="vehicle-card"][data-vehicle-id="project-garage-find"]').within(() => {
      cy.contains("h2", "Project Garage Find");
      cy.contains("Honda · CB350 · 1972");
      cy.contains("No entries yet");
      cy.contains("31,118");
    });
  });

  it("renders the add-vehicle tile as the grid's final cell", () => {
    cy.get('[data-testid="vehicle-grid"]').children().last().should("have.attr", "data-testid", "add-tile");
    cy.get('[data-testid="add-tile"]').should("contain", "Add a vehicle");
  });

  it("navigates to a vehicle's detail screen when its card is selected", () => {
    cy.get('[data-testid="vehicle-card"][data-vehicle-id="sunday-bike"]').click();
    cy.location("pathname").should("eq", "/garage/sunday-bike");
  });

  it("navigates to the add-vehicle screen from the grid tile and the top bar action", () => {
    cy.get('[data-testid="add-tile"]').click();
    cy.location("pathname").should("eq", "/garage/add");

    cy.visit("/garage");
    cy.get('[data-testid="topbar-add-vehicle-btn"]').click();
    cy.location("pathname").should("eq", "/garage/add");
  });
});
