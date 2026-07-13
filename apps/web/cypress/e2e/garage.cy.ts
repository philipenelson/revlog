const VEHICLES_FIXTURE = [
  { id: "the-daily", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, logEntryCount: 12 },
  { id: "sunday-bike", nickname: "Sunday Bike", make: "Ducati", model: "Scrambler Icon", year: 2019, mileage: 8402, photoUrl: null, logEntryCount: 7 },
  { id: "project-garage-find", nickname: "Project Garage Find", make: "Honda", model: "CB350", year: 1972, mileage: 31118, photoUrl: null, logEntryCount: 0 },
];

const ACCOUNT_PROFILE = { id: "e2e-user", fullName: "Jordan Reyes", email: "jordan@example.com", role: "OWNER" };

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
 * `GET /users/me` (account menu info, `docs/specs/web/account-menu.md`) is stubbed
 * with a default profile here since every Garage mount fetches it; override with a
 * fresh `cy.intercept` in a test that needs different account data.
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
  cy.intercept("GET", "**/users/me", { statusCode: 200, body: ACCOUNT_PROFILE }).as("getMe");

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

    it("shows the glyph icon when a vehicle has no photo", () => {
      cy.get('[data-testid="vehicle-card"][data-vehicle-id="the-daily"]')
        .find("img")
        .should("not.exist");
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

  describe("session restored on reload", () => {
    it("silently restores the session via POST /auth/refresh and re-renders the garage without bouncing through /login", () => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }));
      cy.wait("@getVehicles");

      // A reload wipes AuthProvider's in-memory session (ADR 0016), but the
      // HttpOnly refreshToken cookie survives — AuthProvider now attempts a
      // silent restore via POST /auth/refresh on mount (UC-AUTH-7 / ADR 0017).
      // Stub it to succeed with a fresh access token so the garage can re-fetch
      // and render in place, with no detour through /login.
      cy.intercept("POST", "**/auth/refresh", {
        statusCode: 200,
        body: {
          accessToken: "e2e-garage-restored-access-token",
          user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
          account: { id: "e2e-account", status: "ACTIVE" },
        },
      }).as("refresh");
      cy.intercept("GET", "**/vehicles", { statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }).as("getVehiclesAfterReload");

      cy.reload();

      cy.wait("@refresh");
      cy.wait("@getVehiclesAfterReload");
      cy.location("pathname").should("eq", "/garage");
      cy.get('[data-testid="vehicle-grid"]').should("be.visible");
      cy.get('[data-testid="email-input"]').should("not.exist");
    });
  });

  describe("session lost on reload", () => {
    it("redirects to sign-in when the silent restore genuinely fails, instead of showing a load error with a dead retry button", () => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }));
      cy.wait("@getVehicles");

      // The refresh-token cookie can survive a reload but still be invalid,
      // expired, or revoked — AuthProvider's silent restore (UC-AUTH-7 / ADR
      // 0017) genuinely fails in that case, and there's no access token left
      // to fetch with. The screen should send the user to re-authenticate
      // rather than show a "couldn't load your garage" error whose "Try
      // again" could never succeed without a session.
      cy.intercept("POST", "**/auth/refresh", { statusCode: 401, body: { error: "Invalid or expired session" } }).as("refresh");

      cy.reload();

      cy.wait("@refresh");
      cy.location("pathname").should("eq", "/login");
      cy.get('[data-testid="email-input"]').should("be.visible");
      cy.get('[data-testid="error-state"]').should("not.exist");
    });
  });

  describe("vehicle card photo strip", () => {
    it("renders a photo strip with the vehicle's image when photoUrl is set", () => {
      const vehiclesWithPhoto = [
        { ...VEHICLES_FIXTURE[0], photoUrl: "http://localhost:3001/uploads/vehicles/bike.jpg" },
      ];

      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: vehiclesWithPhoto } }));
      cy.wait("@getVehicles");

      cy.get('[data-testid="vehicle-card"][data-vehicle-id="the-daily"]').within(() => {
        cy.get("img").should("have.attr", "src", "http://localhost:3001/uploads/vehicles/bike.jpg");
      });
    });
  });

  describe("account menu", () => {
    beforeEach(() => {
      signIntoGarage(stubVehiclesWith({ statusCode: 200, body: { vehicles: VEHICLES_FIXTURE } }));
      cy.wait("@getVehicles");
      cy.wait("@getMe");
    });

    it("opens on avatar click, shows account info, legal links, support, and log out; closes on outside click", () => {
      cy.get('[data-testid="account-menu"]').should("not.exist");

      cy.get('[data-testid="avatar"]').click();
      cy.get('[data-testid="account-menu"]').should("be.visible");
      cy.get('[data-testid="account-menu-name"]').should("have.text", "Jordan Reyes");
      cy.get('[data-testid="account-menu-email"]').should("have.text", "jordan@example.com");
      cy.get('[data-testid="account-menu-terms"]').should("have.attr", "href", "/terms");
      cy.get('[data-testid="account-menu-privacy"]').should("have.attr", "href", "/privacy");
      cy.get('[data-testid="account-menu-cookies"]').should("have.attr", "href", "/cookies");
      cy.get('[data-testid="account-menu-support"]').should("have.attr", "href", "mailto:hello@revlog.app");
      cy.get('[data-testid="account-menu-logout"]').should("contain", "Log out");

      cy.get("body").click(0, 0);
      cy.get('[data-testid="account-menu"]').should("not.exist");
    });

    it("closes on Escape", () => {
      cy.get('[data-testid="avatar"]').click();
      cy.get('[data-testid="account-menu"]').should("be.visible");
      cy.get("body").type("{esc}");
      cy.get('[data-testid="account-menu"]').should("not.exist");
    });

    it("navigates to the Terms page and closes the menu", () => {
      cy.get('[data-testid="avatar"]').click();
      cy.get('[data-testid="account-menu-terms"]').click();
      cy.location("pathname").should("eq", "/terms");
    });

    it("logs out: calls POST /auth/logout, clears the session, and redirects to /login", () => {
      cy.intercept("POST", "**/auth/logout", { statusCode: 204 }).as("logout");

      cy.get('[data-testid="avatar"]').click();
      cy.get('[data-testid="account-menu-logout"]').click();

      cy.wait("@logout");
      cy.location("pathname").should("eq", "/login");
    });

    it("keeps the session and shows an error when logout fails with no server response", () => {
      cy.intercept("POST", "**/auth/logout", { forceNetworkError: true }).as("logoutFailed");

      cy.get('[data-testid="avatar"]').click();
      cy.get('[data-testid="account-menu-logout"]').click();

      cy.wait("@logoutFailed");
      cy.location("pathname").should("eq", "/garage");
      cy.get('[data-testid="account-menu-logout-error"]').should("contain", "You need to be online to log out.");
    });
  });
});
