// ── Shared fixtures ──────────────────────────────────────────────────────────

const J_VEHICLE_ID = "the-daily";
const J_ENTRY_ID = "entry-1";
const J_ACCESS_TOKEN = "e2e-journey-access-token";

const J_VEHICLE_FIXTURE = {
  id: J_VEHICLE_ID,
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: 2021,
  mileage: 14230,
  photoUrl: null,
  logEntryCount: 1,
};

const LOG_ENTRY_SUMMARY = {
  id: J_ENTRY_ID,
  typeId: "MAINTENANCE",
  title: "Oil & filter change",
  date: "2026-05-15",
  time: "09:00",
  mileage: 14000,
  itemCount: 1,
  mediaCount: 0,
  totalCost: "45.00",
};

const J_ENTRY_FIXTURE = {
  id: J_ENTRY_ID,
  vehicleId: J_VEHICLE_ID,
  typeId: "MAINTENANCE",
  title: "Oil & filter change",
  date: "2026-05-15",
  time: "09:00",
  mileage: 14000,
  notes: "Used synthetic 5W-30",
  items: [
    {
      id: "item-1",
      categoryId: "PART",
      description: "Oil filter",
      quantity: "1",
      unitCost: "12.50",
      totalCost: "12.50",
      sortOrder: 0,
    },
  ],
  media: [],
  totalCost: "45.00",
  createdAt: "2026-05-15T09:00:00Z",
  updatedAt: "2026-05-15T09:00:00Z",
};

const J_INSURANCE_FIXTURE = {
  company: "State Farm",
  policyNumber: "SF-2026-001",
  startDate: "2026-01-01",
  expiryDate: "2027-01-01",
  premium: "120.00",
  premiumPeriod: "MONTHLY",
  towNumber: "1-800-555-0100",
  notes: "Comprehensive plus roadside",
};

const VEHICLE_DETAIL_FIXTURE = {
  id: J_VEHICLE_ID,
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: 2021,
  mileage: 14230,
  photoUrl: null,
  insurance: null,
  logEntries: [LOG_ENTRY_SUMMARY],
  stats: { totalSpent: "45.00", lastLoggedAt: "2026-05-15" },
};

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Stubs POST /auth/login and drives the real login form to get an in-memory
 * access token into AuthProvider. Required for screens that make API calls on
 * mount (e.g. garage, vehicle detail) — see garage.cy.ts for the rationale.
 */
function jSignIn(accountStatus = "ACTIVE") {
  cy.setCookie("refreshToken", "e2e-journey-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: J_ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: accountStatus },
    },
  }).as("login");

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("journey-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();
  cy.wait("@login");
}

function jSignIntoGarage() {
  cy.intercept("GET", "**/vehicles", {
    statusCode: 200,
    body: { vehicles: [J_VEHICLE_FIXTURE] },
  }).as("getVehicles");

  jSignIn();
  cy.location("pathname").should("eq", "/garage");
  cy.wait("@getVehicles");
}

function jSignIntoVehicleDetail(vehicleBody = { vehicle: VEHICLE_DETAIL_FIXTURE }) {
  cy.intercept("GET", `**/vehicles/${J_VEHICLE_ID}`, {
    statusCode: 200,
    body: vehicleBody,
  }).as("getVehicleDetail");

  jSignIn();
  cy.visit(`/garage/${J_VEHICLE_ID}`);
  cy.wait("@getVehicleDetail");
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("App smoke test — happy paths", () => {
  // ── Auth ────────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("signs in with valid credentials and lands on the garage", () => {
      jSignIntoGarage();

      cy.contains("Revlog").should("be.visible");
      cy.get('[data-testid="vehicle-card"]').should("have.length", 1);
    });
  });

  describe("registration", () => {
    it("submits the register form and lands on the email-verification waiting screen", () => {
      cy.intercept("POST", "**/auth/register", {
        statusCode: 201,
        body: { message: "Check your inbox to verify your email" },
      }).as("register");

      cy.visit("/login");
      cy.get('[data-testid="register-tab"]').click();
      cy.get('[data-testid="name-input"]').type("Jordan Reyes");
      cy.get('[data-testid="email-input"]').type("newuser@example.com");
      cy.get('[data-testid="password-input"]').type("correct horse battery staple 9");
      cy.get('[data-testid="confirm-password-input"]').type("correct horse battery staple 9");
      cy.contains("button", "Create account").click();
      cy.wait("@register");

      cy.location("pathname").should("eq", "/verify-email");
      cy.get('[data-testid="verify-waiting"]').should("contain", "newuser@example.com");
    });
  });

  describe("email verification", () => {
    it("renders the verification waiting screen with the emailed address", () => {
      cy.visit("/verify-email?email=rider%40example.com");
      cy.get('[data-testid="verify-waiting"]').should("contain", "rider@example.com");
    });
  });

  describe("unauthenticated redirects", () => {
    it("redirects /garage and /onboarding to /login when no session exists", () => {
      cy.clearCookies();

      cy.visit("/garage");
      cy.location("pathname").should("eq", "/login");

      cy.visit("/onboarding");
      cy.location("pathname").should("eq", "/login");
    });
  });

  describe("session restore on reload", () => {
    it("silently restores session via POST /auth/refresh and stays on /garage", () => {
      jSignIntoGarage();

      cy.intercept("POST", "**/auth/refresh", {
        statusCode: 200,
        body: {
          accessToken: "e2e-journey-restored-access-token",
          user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
          account: { id: "e2e-account", status: "ACTIVE" },
        },
      }).as("refresh");
      cy.intercept("GET", "**/vehicles", {
        statusCode: 200,
        body: { vehicles: [J_VEHICLE_FIXTURE] },
      }).as("getVehiclesAfterReload");

      cy.reload();
      cy.wait("@refresh");
      cy.wait("@getVehiclesAfterReload");

      cy.location("pathname").should("eq", "/garage");
      cy.get('[data-testid="vehicle-card"]').should("have.length", 1);
    });
  });

  // ── Onboarding ──────────────────────────────────────────────────────────────

  describe("onboarding — add first vehicle", () => {
    it("steps through welcome → vehicle form → adds vehicle → lands on garage", () => {
      cy.intercept("GET", "**/vehicles", {
        statusCode: 200,
        body: { vehicles: [J_VEHICLE_FIXTURE] },
      }).as("getVehicles");

      jSignIn("ONBOARDING");
      cy.location("pathname").should("eq", "/onboarding");

      cy.get('[data-testid="step-welcome"]').should("be.visible");
      cy.contains("button", "Add first vehicle").click();

      cy.get('[data-testid="make-input"]').type("Triumph");
      cy.get('[data-testid="model-input"]').type("Street Triple RS");
      cy.get('[data-testid="year-input"]').type("2021");
      cy.get('[data-testid="mileage-input"]').type("14230");

      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: J_VEHICLE_FIXTURE },
      }).as("createVehicle");

      cy.contains("button", "Add vehicle").click();
      cy.wait("@createVehicle");

      cy.get('[data-testid="step-ready"]').should("be.visible");
      cy.contains("Triumph · Street Triple RS").should("be.visible");

      cy.contains("button", "Go to garage").click();
      cy.wait("@getVehicles");
      cy.location("pathname").should("eq", "/garage");
    });
  });

  describe("onboarding — skip", () => {
    it("skips onboarding and lands on an empty garage", () => {
      cy.intercept("POST", "**/onboarding/skip", {
        statusCode: 200,
        body: {},
      }).as("skipOnboarding");
      cy.intercept("GET", "**/vehicles", {
        statusCode: 200,
        body: { vehicles: [] },
      }).as("getVehicles");

      jSignIn("ONBOARDING");
      cy.location("pathname").should("eq", "/onboarding");

      cy.contains("button", "Skip onboarding").click();
      cy.wait("@skipOnboarding");
      cy.wait("@getVehicles");

      cy.location("pathname").should("eq", "/garage");
    });
  });

  // ── Garage ───────────────────────────────────────────────────────────────────

  describe("garage", () => {
    beforeEach(() => {
      jSignIntoGarage();
    });

    it("renders vehicle cards with name, make·model·year, and mileage", () => {
      cy.get('[data-testid="vehicle-card"][data-vehicle-id="the-daily"]').within(() => {
        cy.contains("The Daily");
        cy.contains("Triumph · Street Triple RS · 2021");
        cy.contains("14,230");
      });
    });

    it("navigates to the vehicle detail screen when a card is clicked", () => {
      cy.intercept("GET", `**/vehicles/${J_VEHICLE_ID}`, {
        statusCode: 200,
        body: { vehicle: VEHICLE_DETAIL_FIXTURE },
      }).as("getVehicleDetail");

      cy.get('[data-testid="vehicle-card"][data-vehicle-id="the-daily"]').click();
      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}`);
    });

    it("navigates to /garage/add from the top bar action", () => {
      cy.get('[data-testid="topbar-add-vehicle-btn"]').click();
      cy.location("pathname").should("eq", "/garage/add");
    });
  });

  // ── Add vehicle ──────────────────────────────────────────────────────────────

  describe("add vehicle", () => {
    it("fills the form, submits, and navigates back to the garage", () => {
      jSignIntoGarage();
      cy.get('[data-testid="topbar-add-vehicle-btn"]').click();
      cy.location("pathname").should("eq", "/garage/add");

      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { ...J_VEHICLE_FIXTURE, id: "new-bike", nickname: null } },
      }).as("createVehicle");

      cy.get('[data-testid="make-input"]').type("Honda");
      cy.get('[data-testid="model-input"]').type("CB500F");
      cy.get('[data-testid="year-input"]').type("2022");
      cy.get('[data-testid="mileage-input"]').type("5000");
      cy.get('[data-testid="add-vehicle-btn"]').click();
      cy.wait("@createVehicle");

      cy.location("pathname").should("eq", "/garage");
    });
  });

  // ── Vehicle detail ────────────────────────────────────────────────────────────

  describe("vehicle detail", () => {
    beforeEach(() => {
      jSignIntoVehicleDetail();
    });

    it("shows the vehicle hero, stats strip, and service history list", () => {
      cy.get('[data-testid="vehicle-display-name"]').should("contain", "The Daily");
      cy.get('[data-testid="vehicle-meta"]').should("contain", "Triumph · Street Triple RS · 2021");
      cy.get('[data-testid="stat-odometer"]').should("contain", "14,230").and("contain", "mi");
      cy.get('[data-testid="stat-entry-count"]').should("contain", "1");
      cy.get('[data-testid="log-entry-card"][data-entry-id="entry-1"]').within(() => {
        cy.get('[data-testid="entry-type-badge"]').should("contain", "Maintenance");
        cy.get('[data-testid="entry-title"]').should("contain", "Oil & filter change");
      });
    });

    it("[+ Log entry] navigates to the new log entry screen", () => {
      cy.get('[data-testid="new-log-entry-btn"]').click();
      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}/log/new`);
    });

    it("[Edit] navigates to the edit vehicle screen", () => {
      cy.get('[data-testid="edit-btn"]').click();
      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}/edit`);
    });
  });

  // ── Insurance ─────────────────────────────────────────────────────────────────

  describe("insurance", () => {
    it("opens the add-insurance dialog, saves, and shows the updated expiry status", () => {
      jSignIntoVehicleDetail();

      cy.intercept("PUT", `**/vehicles/${J_VEHICLE_ID}/insurance`, {
        statusCode: 200,
        body: { insurance: J_INSURANCE_FIXTURE },
      }).as("putInsurance");

      cy.get('[data-testid="insurance-add-btn"]').click();
      cy.get('[data-testid="insurance-dialog"]').should("be.visible");
      cy.get('[data-testid="ins-company"]').type("State Farm");
      cy.get('[data-testid="dialog-save-btn"]').click();
      cy.wait("@putInsurance");

      cy.get('[data-testid="insurance-dialog"]').should("not.exist");
      cy.get('[data-testid="insurance-status"]').should("contain", "Expires");
    });
  });

  // ── Log entry — create ────────────────────────────────────────────────────────

  describe("log entry — create", () => {
    it("selects a type, fills the title, saves, and navigates back to vehicle detail", () => {
      cy.setCookie("refreshToken", "e2e-journey-session");
      cy.visit(`/garage/${J_VEHICLE_ID}/log/new`);

      cy.intercept("POST", `**/vehicles/${J_VEHICLE_ID}/log`, {
        statusCode: 201,
        body: { logEntry: J_ENTRY_FIXTURE },
      }).as("createEntry");

      cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
      cy.get('[data-testid="title-input"]').type("Oil & filter change");
      cy.get('[data-testid="save-btn"]').click();
      cy.wait("@createEntry");

      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}`);
    });
  });

  // ── Log entry — edit ──────────────────────────────────────────────────────────

  describe("log entry — edit", () => {
    it("pre-fills the form, updates the title, saves, and navigates back", () => {
      cy.setCookie("refreshToken", "e2e-journey-session");

      cy.intercept("GET", `**/vehicles/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`, {
        statusCode: 200,
        body: { logEntry: J_ENTRY_FIXTURE },
      }).as("getEntry");

      cy.visit(`/garage/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`);
      cy.wait("@getEntry");

      cy.get('[data-testid="type-pill-MAINTENANCE"]').should("have.attr", "data-active", "true");
      cy.get('[data-testid="title-input"]').should("have.value", "Oil & filter change");

      cy.intercept("PATCH", `**/vehicles/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`, {
        statusCode: 200,
        body: { logEntry: { ...J_ENTRY_FIXTURE, title: "Oil & filter change — full synthetic" } },
      }).as("updateEntry");

      cy.get('[data-testid="title-input"]').clear().type("Oil & filter change — full synthetic");
      cy.get('[data-testid="save-btn"]').click();
      cy.wait("@updateEntry");

      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}`);
    });
  });

  // ── Log entry — delete ────────────────────────────────────────────────────────

  describe("log entry — delete", () => {
    it("opens the delete dialog, confirms, and navigates back to vehicle detail", () => {
      cy.setCookie("refreshToken", "e2e-journey-session");

      cy.intercept("GET", `**/vehicles/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`, {
        statusCode: 200,
        body: { logEntry: J_ENTRY_FIXTURE },
      }).as("getEntry");

      cy.visit(`/garage/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`);
      cy.wait("@getEntry");

      cy.intercept("DELETE", `**/vehicles/${J_VEHICLE_ID}/log/${J_ENTRY_ID}`, {
        statusCode: 204,
      }).as("deleteEntry");

      cy.get('[data-testid="delete-btn"]').click();
      cy.get('[data-testid="delete-dialog"]').should("be.visible");
      cy.get('[data-testid="confirm-delete-btn"]').click();
      cy.wait("@deleteEntry");

      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}`);
    });
  });

  // ── Edit vehicle ──────────────────────────────────────────────────────────────

  describe("edit vehicle", () => {
    it("pre-fills the form, updates mileage, saves, and navigates back to vehicle detail", () => {
      cy.setCookie("refreshToken", "e2e-journey-session");

      cy.intercept("GET", `**/vehicles/${J_VEHICLE_ID}`, {
        statusCode: 200,
        body: { vehicle: J_VEHICLE_FIXTURE },
      }).as("getVehicle");

      cy.visit(`/garage/${J_VEHICLE_ID}/edit`);
      cy.wait("@getVehicle");

      cy.get('[data-testid="mileage-input"]').should("have.value", "14230");

      cy.intercept("PATCH", `**/vehicles/${J_VEHICLE_ID}`, {
        statusCode: 200,
        body: { vehicle: { ...J_VEHICLE_FIXTURE, mileage: 15000 } },
      }).as("updateVehicle");

      cy.get('[data-testid="mileage-input"]').clear().type("15000");
      cy.contains("button", "Save changes").click();
      cy.wait("@updateVehicle");

      cy.location("pathname").should("eq", `/garage/${J_VEHICLE_ID}`);
    });
  });
});
