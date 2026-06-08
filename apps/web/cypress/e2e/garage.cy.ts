const VEHICLES_FIXTURE = [
  { id: "the-daily", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, logEntryCount: 12 },
  { id: "sunday-bike", nickname: "Sunday Bike", make: "Ducati", model: "Scrambler Icon", year: 2019, mileage: 8402, logEntryCount: 7 },
  { id: "project-garage-find", nickname: "Project Garage Find", make: "Honda", model: "CB350", year: 1972, mileage: 31118, logEntryCount: 0 },
];

/**
 * Stubs the session-issuing and Vehicle-listing endpoints and drives the real
 * login form to reach `/garage` with an in-memory session populated — `apiFetch`
 * needs `session.accessToken` to call `GET /vehicles` (see ADR 0016: the
 * refresh-token cookie alone gets a visitor past Next.js middleware, but the
 * access token only exists after a real client-side sign-in). This keeps the
 * spec exercising the garage screen's own wiring in isolation from the rest of
 * the auth flow (covered end-to-end by journey.cy.ts), while still driving the
 * real request path `apiFetch` → `GET /vehicles` → render.
 *
 * `stubVehicles` sets up the `GET /vehicles` intercept — the caller controls its
 * shape (and timing) per scenario, so it must run before `cy.visit` fires the request.
 */
function signIntoGarage(stubVehicles: () => void) {
  cy.setCookie("refreshToken", "e2e-garage-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: "e2e-garage-access-token",
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  stubVehicles();

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("garage-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();

  cy.wait("@login");
  cy.location("pathname").should("eq", "/garage");
}

function stubVehiclesWith(response: { statusCode: number; body: unknown; delay?: number }) {
  return () => {
    cy.intercept("GET", "**/vehicles", response).as("getVehicles");
  };
}

describe("Garage screen", () => {
  describe("populated garage", () => {
    beforeEach(() => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }));
      cy.wait("@getVehicles");
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

    it("navigates to the add-vehicle screen from the grid's dashed tile", () => {
      cy.get('[data-testid="add-tile"]').click();
      cy.location("pathname").should("eq", "/garage/add");
    });

    it("navigates to the add-vehicle screen from the top bar action", () => {
      cy.get('[data-testid="topbar-add-vehicle-btn"]').click();
      cy.location("pathname").should("eq", "/garage/add");
    });
  });

  describe("loading state", () => {
    it("shows a loading state while the vehicle list is in flight, then renders it", () => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE }, delay: 500 }));

      cy.get('[data-testid="loading-state"]').should("be.visible");
      cy.wait("@getVehicles");
      cy.get('[data-testid="loading-state"]').should("not.exist");
      cy.get('[data-testid="vehicle-grid"]').should("be.visible");
    });
  });

  describe("empty garage", () => {
    beforeEach(() => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: [] } }));
      cy.wait("@getVehicles");
    });

    it("renders the header as 'Your garage' with no count and no sort sub-line", () => {
      cy.get('[data-testid="page-title"]').should("have.text", "Your garage");
      cy.get('[data-testid="page-sub"]').should("not.exist");
    });

    it("renders the empty-state illustration, headline, copy, and CTA", () => {
      cy.get('[data-testid="vehicle-grid"]').should("not.exist");
      cy.get('[data-testid="empty-state"]').within(() => {
        cy.contains("h2", "Your garage is empty");
        cy.contains("Add your first vehicle to start building its service history");
        cy.get('[data-testid="empty-cta"]').should("contain", "Add your first vehicle");
      });
    });

    it("navigates to the add-vehicle screen from the empty state's CTA", () => {
      cy.get('[data-testid="empty-cta"]').click();
      cy.location("pathname").should("eq", "/garage/add");
    });
  });

  describe("failed load", () => {
    it("shows an error state on failure and recovers when retried", () => {
      signIntoGarage(stubVehiclesWith({ statusCode: 500, body: { error: "Internal Server Error" } }));

      cy.wait("@getVehicles");
      cy.get('[data-testid="error-state"]').should("be.visible").and("contain", "couldn't load your garage");
      cy.get('[data-testid="vehicle-grid"]').should("not.exist");

      // Re-stub before retrying — Cypress routes new requests through the most
      // recently registered matching intercept, so this is what "the backend
      // recovered" looks like from the test's perspective.
      cy.intercept("GET", "**/vehicles", { statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }).as("retryVehicles");
      cy.get('[data-testid="retry-btn"]').click();
      cy.wait("@retryVehicles");
      cy.get('[data-testid="error-state"]').should("not.exist");
      cy.get('[data-testid="vehicle-grid"]').should("be.visible");
    });
  });

  describe("session lost on reload", () => {
    it("redirects to sign-in instead of showing a load error with a dead retry button", () => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }));
      cy.wait("@getVehicles");

      // A reload wipes AuthProvider's in-memory session (ADR 0016 — "no
      // session restoration on reload"); the refresh-token cookie still gets
      // a visitor past middleware, but there's no access token left to fetch
      // with. The screen should send the user to re-authenticate rather than
      // show a "couldn't load your garage" error whose "Try again" could
      // never succeed without a session.
      cy.reload();

      cy.location("pathname").should("eq", "/login");
      cy.get('[data-testid="email-input"]').should("be.visible");
      cy.get('[data-testid="error-state"]').should("not.exist");
    });
  });
});
