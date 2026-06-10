const VEHICLE_ID = "the-daily";
const ACCESS_TOKEN = "e2e-vehicle-detail-access-token";

const INSURANCE_FIXTURE = {
  company: "State Farm",
  policyNumber: "SF-2026-001",
  startDate: "2026-01-01",
  expiryDate: "2027-01-01",
  premium: "120.00",
  premiumPeriod: "MONTHLY",
  towNumber: "1-800-555-0100",
  notes: "Comprehensive plus roadside",
};

const LOG_ENTRIES_FIXTURE = [
  {
    id: "entry-1",
    typeId: "MAINTENANCE",
    title: "Oil & filter change",
    date: "2026-05-15",
    time: "09:00",
    mileage: 14000,
    itemCount: 2,
    mediaCount: 1,
    totalCost: "45.00",
  },
  {
    id: "entry-2",
    typeId: "REPAIR",
    title: "Brake pad replacement",
    date: "2026-04-10",
    time: null,
    mileage: 13500,
    itemCount: 1,
    mediaCount: 0,
    totalCost: "120.00",
  },
  {
    id: "entry-3",
    typeId: "INSPECTION",
    title: "Annual roadworthiness check",
    date: "2026-03-01",
    time: null,
    mileage: 13000,
    itemCount: 0,
    mediaCount: 0,
    totalCost: null,
  },
];

const VEHICLE_DETAIL_WITH_INSURANCE = {
  id: VEHICLE_ID,
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: 2021,
  mileage: 14230,
  photoUrl: null,
  insurance: INSURANCE_FIXTURE,
  logEntries: LOG_ENTRIES_FIXTURE,
  stats: { totalSpent: "165.00", lastLoggedAt: "2026-05-15" },
};

const VEHICLE_DETAIL_NO_INSURANCE = {
  ...VEHICLE_DETAIL_WITH_INSURANCE,
  insurance: null,
};

const VEHICLE_DETAIL_EMPTY_HISTORY = {
  ...VEHICLE_DETAIL_NO_INSURANCE,
  logEntries: [],
  stats: { totalSpent: "0.00", lastLoggedAt: null },
};

const VEHICLE_DETAIL_WITH_PHOTO = {
  ...VEHICLE_DETAIL_NO_INSURANCE,
  photoUrl: "http://localhost:4000/uploads/vehicles/bike.jpg",
};

/**
 * The second `cy.visit()` to /garage/:id wipes the in-memory session
 * (ADR 0016). Stub the silent restore so the page has a session to fetch
 * the vehicle with — same pattern as journey.cy.ts's jStubAuthRefresh.
 */
function stubVehicleDetailAuthRefresh() {
  cy.intercept("POST", "**/auth/refresh", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("refresh");
}

/**
 * Sign in and navigate to the vehicle detail page for VEHICLE_ID.
 * `stubDetail` sets up the GET /vehicles/:id intercept before visiting.
 */
function signIntoVehicleDetail(stubDetail: () => void) {
  cy.setCookie("refreshToken", "e2e-vehicle-detail-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  stubDetail();

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("detail-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();
  cy.wait("@login");

  stubVehicleDetailAuthRefresh();
  cy.visit(`/garage/${VEHICLE_ID}`);
  cy.wait("@refresh");
}

function stubVehicleDetail(body: unknown, statusCode = 200) {
  return () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, { statusCode, body }).as("getVehicleDetail");
  };
}

describe("Vehicle Detail screen", () => {
  describe("hero panel", () => {
    it("renders the vehicle glyph when no photo is set", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="hero-glyph"]').should("exist");
      cy.get('[data-testid="hero-photo"]').should("not.exist");
    });

    it("renders the vehicle photo when photoUrl is set", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_WITH_PHOTO }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="hero-photo"]').should("exist").and("have.attr", "src").and("include", "bike.jpg");
      cy.get('[data-testid="hero-glyph"]').should("not.exist");
    });

    it("shows the vehicle display name and make·model·year", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="vehicle-display-name"]').should("contain", "The Daily");
      cy.get('[data-testid="vehicle-meta"]').should("contain", "Triumph · Street Triple RS · 2021");
    });
  });

  describe("top bar", () => {
    beforeEach(() => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");
    });

    it("renders the Revlog wordmark", () => {
      cy.contains("Revlog").should("be.visible");
    });

    it("[✎ Edit] navigates to the edit page", () => {
      cy.get('[data-testid="edit-btn"]').should("have.attr", "href", `/garage/${VEHICLE_ID}/edit`);
    });

    it("[+ Log entry] navigates to the new log entry page", () => {
      cy.get('[data-testid="new-log-entry-btn"]')
        .should("have.attr", "href", `/garage/${VEHICLE_ID}/log/new`);
    });

    it("back link navigates to /garage", () => {
      cy.get('[data-testid="back-link"]').should("have.attr", "href", "/garage");
    });
  });

  describe("stats strip", () => {
    beforeEach(() => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_WITH_INSURANCE }));
      cy.wait("@getVehicleDetail");
    });

    it("shows the vehicle mileage with mi unit", () => {
      cy.get('[data-testid="stat-odometer"]').should("contain", "14,230").and("contain", "mi");
    });

    it("shows the log entry count", () => {
      cy.get('[data-testid="stat-entry-count"]').should("contain", "3");
    });

    it("shows the last logged date", () => {
      cy.get('[data-testid="stat-last-logged"]').should("contain", "2026");
    });

    it("shows total spent as currency", () => {
      cy.get('[data-testid="stat-total-spent"]').should("contain", "$165");
    });

    it("shows None and Never for a vehicle with no history", () => {
      cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 200,
        body: { vehicle: VEHICLE_DETAIL_EMPTY_HISTORY },
      }).as("getEmpty");
      cy.reload();
      cy.wait("@getEmpty");

      cy.get('[data-testid="stat-entry-count"]').should("contain", "None");
      cy.get('[data-testid="stat-last-logged"]').should("contain", "Never");
      cy.get('[data-testid="stat-total-spent"]').should("contain", "—");
    });
  });

  describe("insurance row", () => {
    it("shows expiry date when insurance is on file", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_WITH_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="insurance-status"]').should("contain", "Expires");
      cy.get('[data-testid="insurance-details-btn"]').should("be.visible").and("contain", "Details");
    });

    it("shows 'No insurance on file' when no insurance record exists", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="insurance-status"]').should("contain", "No insurance on file");
      cy.get('[data-testid="insurance-add-btn"]').should("be.visible").and("contain", "Add");
    });

    it("[Details →] opens the insurance dialog in read mode", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_WITH_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="insurance-details-btn"]').click();
      cy.get('[data-testid="insurance-dialog"]').should("be.visible");
      cy.get('[data-testid="dialog-edit-btn"]').should("be.visible");
      cy.get('[data-testid="dialog-save-btn"]').should("not.exist");
    });

    it("[Add →] opens the insurance dialog in edit mode", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="insurance-add-btn"]').click();
      cy.get('[data-testid="insurance-dialog"]').should("be.visible");
      cy.get('[data-testid="dialog-save-btn"]').scrollIntoView().should("be.visible");
      cy.get('[data-testid="dialog-edit-btn"]').should("not.exist");
    });

    it("save calls PUT /insurance and updates the row on success", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.intercept("PUT", `**/vehicles/${VEHICLE_ID}/insurance`, {
        statusCode: 200,
        body: { insurance: INSURANCE_FIXTURE },
      }).as("putInsurance");

      cy.get('[data-testid="insurance-add-btn"]').click();
      cy.get('[data-testid="ins-company"]').type("State Farm");
      cy.get('[data-testid="dialog-save-btn"]').click();
      cy.wait("@putInsurance");

      cy.get('[data-testid="insurance-dialog"]').should("not.exist");
      cy.get('[data-testid="insurance-status"]').should("contain", "Expires");
    });

    it("shows an inline error when save fails", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_NO_INSURANCE }));
      cy.wait("@getVehicleDetail");

      cy.intercept("PUT", `**/vehicles/${VEHICLE_ID}/insurance`, { statusCode: 500 }).as("putInsuranceFail");

      cy.get('[data-testid="insurance-add-btn"]').click();
      cy.get('[data-testid="dialog-save-btn"]').click();
      cy.wait("@putInsuranceFail");

      cy.get('[data-testid="dialog-save-error"]').should("be.visible");
      cy.get('[data-testid="insurance-dialog"]').should("exist");
    });
  });

  describe("service history list", () => {
    beforeEach(() => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_WITH_INSURANCE }));
      cy.wait("@getVehicleDetail");
    });

    it("renders one card per log entry", () => {
      cy.get('[data-testid="log-entry-card"]').should("have.length", 3);
    });

    it("each card shows type badge, title, date, mileage, and cost", () => {
      cy.get('[data-testid="log-entry-card"][data-entry-id="entry-1"]').within(() => {
        cy.get('[data-testid="entry-type-badge"]').should("contain", "Maintenance");
        cy.get('[data-testid="entry-title"]').should("contain", "Oil & filter change");
        cy.contains("May 15, 2026");
        cy.contains("14,000 mi");
        cy.get('[data-testid="entry-cost"]').should("contain", "$45.00");
      });
    });

    it("each card links to the log entry detail page", () => {
      cy.get('[data-testid="log-entry-card"][data-entry-id="entry-2"]')
        .should("have.attr", "href", `/garage/${VEHICLE_ID}/log/entry-2`);
    });

    it("type filter hides entries that don't match the selected type", () => {
      cy.get('[data-testid="type-filter"]').select("REPAIR");

      cy.get('[data-testid="log-entry-card"]').should("have.length", 1);
      cy.get('[data-testid="log-entry-card"][data-entry-id="entry-2"]').should("exist");
      cy.get('[data-testid="log-entry-card"][data-entry-id="entry-1"]').should("not.exist");
    });

    it("resetting type filter back to All shows all entries", () => {
      cy.get('[data-testid="type-filter"]').select("REPAIR");
      cy.get('[data-testid="type-filter"]').select("All types");
      cy.get('[data-testid="log-entry-card"]').should("have.length", 3);
    });
  });

  describe("empty service history", () => {
    it("renders an empty state with CTA when there are no log entries", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_EMPTY_HISTORY }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="empty-history"]').should("be.visible");
      cy.get('[data-testid="log-entry-list"]').should("not.exist");
    });

    it("empty state CTA links to the new log entry page", () => {
      signIntoVehicleDetail(stubVehicleDetail({ vehicle: VEHICLE_DETAIL_EMPTY_HISTORY }));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="empty-history-cta"]')
        .should("have.attr", "href", `/garage/${VEHICLE_ID}/log/new`);
    });
  });

  describe("error and not-found states", () => {
    it("renders an error state on API failure", () => {
      signIntoVehicleDetail(stubVehicleDetail({}, 500));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="error-state"]').should("be.visible");
    });

    it("recovers on retry after an error", () => {
      signIntoVehicleDetail(stubVehicleDetail({}, 500));
      cy.wait("@getVehicleDetail");

      cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 200,
        body: { vehicle: VEHICLE_DETAIL_NO_INSURANCE },
      }).as("getVehicleDetailRetry");

      cy.get('[data-testid="retry-btn"]').click();
      cy.wait("@getVehicleDetailRetry");

      cy.get('[data-testid="vehicle-detail-page"]').should("contain", "The Daily");
      cy.get('[data-testid="error-state"]').should("not.exist");
    });

    it("renders a not-found state on 404", () => {
      signIntoVehicleDetail(stubVehicleDetail({ error: "Vehicle not found" }, 404));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="not-found-state"]').should("be.visible");
    });

    it("not-found state has a link back to /garage", () => {
      signIntoVehicleDetail(stubVehicleDetail({ error: "Vehicle not found" }, 404));
      cy.wait("@getVehicleDetail");

      cy.get('[data-testid="back-to-garage-btn"]').should("have.attr", "href", "/garage");
    });
  });
});
