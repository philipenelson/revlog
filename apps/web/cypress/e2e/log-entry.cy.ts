const VEHICLE_ID = "vehicle-1";
const ENTRY_ID = "entry-1";

const ACCESS_TOKEN = "e2e-log-entry-access-token";

const ENTRY_FIXTURE = {
  id: ENTRY_ID,
  vehicleId: VEHICLE_ID,
  typeId: "MAINTENANCE",
  title: "10,000 km service",
  date: "2026-01-15",
  time: "10:00",
  mileage: 15000,
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
  totalCost: "12.50",
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
};

/**
 * Sign into the app and navigate to the log entry create screen.
 * Stubs auth, vehicles list, and any other needed endpoints.
 */
function signIntoNewLogEntry() {
  cy.setCookie("refreshToken", "e2e-log-entry-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  cy.intercept("GET", "**/vehicles", {
    statusCode: 200,
    body: {
      vehicles: [
        {
          id: VEHICLE_ID,
          nickname: "My Bike",
          make: "Honda",
          model: "CB500F",
          year: 2021,
          mileage: 14000,
          photoUrl: null,
          logEntryCount: 0,
        },
      ],
    },
  }).as("getVehicles");

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("log-entry-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();
  cy.wait("@login");
  cy.location("pathname").should("eq", "/garage");
}

describe("Log entry create screen (/garage/:vehicleId/log/new)", () => {
  beforeEach(() => {
    cy.setCookie("refreshToken", "e2e-log-entry-session");
    cy.visit(`/garage/${VEHICLE_ID}/log/new`);
  });

  it("renders the page heading and back link", () => {
    cy.get('[data-testid="page-heading"]').should("contain", "New log entry");
    cy.get('[data-testid="back-link"]').should(
      "have.attr",
      "href",
      `/garage/${VEHICLE_ID}`,
    );
  });

  it("renders all 7 type pills", () => {
    const TYPES = [
      "MAINTENANCE",
      "REPAIR",
      "INSPECTION",
      "MODIFICATION",
      "INCIDENT",
      "EVENT",
      "OTHER",
    ];
    cy.get('[data-testid="type-pills"]').within(() => {
      TYPES.forEach((type) => {
        cy.get(`[data-testid="type-pill-${type}"]`).should("exist");
      });
    });
  });

  it("selecting a type pill highlights it", () => {
    cy.get('[data-testid="type-pill-REPAIR"]').click();
    cy.get('[data-testid="type-pill-REPAIR"]').should(
      "have.attr",
      "data-active",
      "true",
    );
    cy.get('[data-testid="type-pill-MAINTENANCE"]').should(
      "have.attr",
      "data-active",
      "false",
    );
  });

  it("Save button is disabled when title is empty", () => {
    cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
    cy.get('[data-testid="save-btn"]').should("be.disabled");
  });

  it("Save button is disabled when typeId is not selected", () => {
    cy.get('[data-testid="title-input"]').type("Oil change");
    cy.get('[data-testid="save-btn"]').should("be.disabled");
  });

  it("Save button is enabled when both typeId and title are filled", () => {
    cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
    cy.get('[data-testid="title-input"]').type("Oil change");
    cy.get('[data-testid="save-btn"]').should("not.be.disabled");
  });

  it("creates a minimal entry and navigates to vehicle detail on success", () => {
    cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/log`, {
      statusCode: 201,
      body: { logEntry: ENTRY_FIXTURE },
    }).as("createEntry");

    cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
    cy.get('[data-testid="title-input"]').type("Oil change");

    cy.get('[data-testid="save-btn"]').click();
    cy.wait("@createEntry");

    cy.location("pathname").should("eq", `/garage/${VEHICLE_ID}`);
  });

  it("creates an entry with items and auto-calculates row total", () => {
    cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/log`, {
      statusCode: 201,
      body: { logEntry: ENTRY_FIXTURE },
    }).as("createEntry");

    cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
    cy.get('[data-testid="title-input"]').type("Oil change");

    cy.get('[data-testid="add-item-btn"]').click();
    cy.get('[data-testid="item-row"]').should("have.length", 1);

    cy.get('[data-testid="item-description"]').type("Oil filter");
    cy.get('[data-testid="item-quantity"]').type("2");
    cy.get('[data-testid="item-unit-cost"]').type("12.50");

    cy.get('[data-testid="item-row-total"]').should("contain", "$25.00");
    cy.get('[data-testid="items-total"]').should("contain", "$25.00");
  });

  it("attaches an image and shows a preview thumbnail", () => {
    cy.get('[data-testid="file-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("fake image data"),
        fileName: "test-photo.jpg",
        mimeType: "image/jpeg",
      },
      { force: true },
    );

    cy.get('[data-testid="media-thumb"]').should("have.length", 1);
    cy.get('[data-testid="media-remove-btn"]').should("exist");
  });

  it("shows an inline error when the API call fails", () => {
    cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/log`, {
      statusCode: 500,
      body: { error: "Internal server error" },
    }).as("createEntry");

    cy.get('[data-testid="type-pill-MAINTENANCE"]').click();
    cy.get('[data-testid="title-input"]').type("Oil change");
    cy.get('[data-testid="save-btn"]').click();

    cy.wait("@createEntry");
    cy.get('[data-testid="form-error"]').should("be.visible");
  });
});

describe("Log entry edit screen (/garage/:vehicleId/log/:entryId)", () => {
  beforeEach(() => {
    cy.setCookie("refreshToken", "e2e-log-entry-session");

    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}/log/${ENTRY_ID}`, {
      statusCode: 200,
      body: { logEntry: ENTRY_FIXTURE },
    }).as("getEntry");

    cy.visit(`/garage/${VEHICLE_ID}/log/${ENTRY_ID}`);
    cy.wait("@getEntry");
  });

  it("shows the edit heading", () => {
    cy.get('[data-testid="page-heading"]').should("contain", "Edit log entry");
  });

  it("pre-fills the form from the fixture data", () => {
    cy.get('[data-testid="type-pill-MAINTENANCE"]').should(
      "have.attr",
      "data-active",
      "true",
    );
    cy.get('[data-testid="title-input"]').should("have.value", "10,000 km service");
    cy.get('[data-testid="date-input"]').should("have.value", "2026-01-15");
    cy.get('[data-testid="mileage-input"]').should("have.value", "15000");
    cy.get('[data-testid="notes-input"]').should("have.value", "Used synthetic 5W-30");
  });

  it("pre-fills item rows from the fixture", () => {
    cy.get('[data-testid="item-row"]').should("have.length", 1);
    cy.get('[data-testid="item-description"]').should("have.value", "Oil filter");
  });

  it("saves edits and navigates back", () => {
    cy.intercept("PATCH", `**/vehicles/${VEHICLE_ID}/log/${ENTRY_ID}`, {
      statusCode: 200,
      body: { logEntry: ENTRY_FIXTURE },
    }).as("updateEntry");

    cy.get('[data-testid="title-input"]').clear().type("Updated service");
    cy.get('[data-testid="save-btn"]').click();

    cy.wait("@updateEntry");
    cy.location("pathname").should("eq", `/garage/${VEHICLE_ID}`);
  });

  it("shows a confirmation dialog when Delete entry is clicked", () => {
    cy.get('[data-testid="delete-btn"]').click();
    cy.get('[data-testid="delete-dialog"]').should("be.visible");
    cy.get('[data-testid="confirm-delete-btn"]').should("be.visible");
    cy.get('[data-testid="cancel-delete-btn"]').should("be.visible");
  });

  it("cancels deletion and keeps the form open", () => {
    cy.get('[data-testid="delete-btn"]').click();
    cy.get('[data-testid="cancel-delete-btn"]').click();
    cy.get('[data-testid="delete-dialog"]').should("not.exist");
    cy.get('[data-testid="title-input"]').should("exist");
  });

  it("confirms deletion, calls DELETE, and navigates back", () => {
    cy.intercept("DELETE", `**/vehicles/${VEHICLE_ID}/log/${ENTRY_ID}`, {
      statusCode: 204,
    }).as("deleteEntry");

    cy.get('[data-testid="delete-btn"]').click();
    cy.get('[data-testid="confirm-delete-btn"]').click();

    cy.wait("@deleteEntry");
    cy.location("pathname").should("eq", `/garage/${VEHICLE_ID}`);
  });
});
