const VEHICLE_ID = "the-daily";
const SHARE_TOKEN = "e2e-share-token-abc123";
const ACCESS_TOKEN = "e2e-printout-access-token";
const SHARE_URL = `http://localhost:3000/report/${SHARE_TOKEN}`;

const VEHICLE_DETAIL = {
  id: VEHICLE_ID,
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: 2021,
  mileage: 14230,
  photoUrl: null,
  insurance: null,
  logEntries: [
    {
      id: "entry-1",
      typeId: "MAINTENANCE",
      title: "Oil & filter change",
      date: "2026-05-15",
      time: "09:00",
      mileage: 14000,
      itemCount: 2,
      mediaCount: 0,
      totalCost: "85.00",
    },
  ],
  stats: { totalSpent: "85.00", lastLoggedAt: "2026-05-15" },
};

const PRINTOUT_FIXTURE = {
  vehicle: {
    nickname: "The Daily",
    make: "Triumph",
    model: "Street Triple RS",
    year: 2021,
    mileage: 14230,
    photoUrl: null,
  },
  stats: {
    logEntryCount: 1,
    lastLoggedAt: "2026-05-15",
    totalSpent: "85.00",
  },
  logEntries: [
    {
      id: "entry-1",
      typeId: "MAINTENANCE",
      title: "Oil & filter change",
      date: "2026-05-15",
      mileage: 14000,
      notes: "Full synthetic 10W-40.",
      items: [
        { categoryId: "PARTS", description: "Oil filter", quantity: "1.000", unitCost: "12.00" },
        { categoryId: "PARTS", description: "Engine oil 1L", quantity: "4.000", unitCost: "14.00" },
        { categoryId: "LABOUR", description: "Labour", quantity: "0.500", unitCost: "34.00" },
      ],
    },
  ],
};

function stubAuthRefresh() {
  cy.intercept("POST", "**/auth/refresh", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("refresh");
}

function signIn() {
  cy.setCookie("refreshToken", "e2e-printout-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("printout-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter");
  cy.contains("button", "Continue").click();
  cy.wait("@login");
}

function goToVehicleDetail() {
  cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
    statusCode: 200,
    body: { vehicle: VEHICLE_DETAIL },
  }).as("getVehicle");

  stubAuthRefresh();
  cy.visit(`/garage/${VEHICLE_ID}`);
  cy.wait("@refresh");
  cy.wait("@getVehicle");
}

describe("Mechanic Printout — share dialog", () => {
  beforeEach(() => {
    signIn();
  });

  it("generates a link and shows the share URL", () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 200,
      body: { shareToken: null, shareUrl: null },
    }).as("getToken");

    cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 201,
      body: { shareToken: SHARE_TOKEN, shareUrl: SHARE_URL },
    }).as("createToken");

    goToVehicleDetail();

    cy.get('[data-testid="share-report-btn"]').click();
    cy.wait("@getToken");

    cy.get('[data-testid="share-report-dialog"]').should("be.visible");
    cy.get('[data-testid="generate-link-btn"]').should("be.visible");

    cy.get('[data-testid="generate-link-btn"]').click();
    cy.wait("@createToken");

    cy.get('[data-testid="share-url"]').should("contain", SHARE_TOKEN);
    cy.get('[data-testid="copy-link-btn"]').should("be.visible");
  });

  it("shows existing token when dialog opens with active token", () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 200,
      body: { shareToken: SHARE_TOKEN, shareUrl: SHARE_URL },
    }).as("getToken");

    goToVehicleDetail();

    cy.get('[data-testid="share-report-btn"]').click();
    cy.wait("@getToken");

    cy.get('[data-testid="share-url"]').should("contain", SHARE_TOKEN);
    cy.get('[data-testid="copy-link-btn"]').should("be.visible");
    cy.get('[data-testid="revoke-btn"]').should("be.visible");
  });

  it("revokes the token and returns to generate state", () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 200,
      body: { shareToken: SHARE_TOKEN, shareUrl: SHARE_URL },
    }).as("getToken");

    cy.intercept("DELETE", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 204,
    }).as("revokeToken");

    goToVehicleDetail();

    cy.get('[data-testid="share-report-btn"]').click();
    cy.wait("@getToken");

    cy.get('[data-testid="revoke-btn"]').click();
    cy.wait("@revokeToken");

    cy.get('[data-testid="generate-link-btn"]').should("be.visible");
    cy.get('[data-testid="share-url"]').should("not.exist");
  });

  it("sends the email and shows confirmation", () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}/report-token`, {
      statusCode: 200,
      body: { shareToken: SHARE_TOKEN, shareUrl: SHARE_URL },
    }).as("getToken");

    cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/report-token/email`, {
      statusCode: 204,
    }).as("sendEmail");

    goToVehicleDetail();

    cy.get('[data-testid="share-report-btn"]').click();
    cy.wait("@getToken");

    cy.get('[data-testid="share-email-input"]').type("mechanic@shop.com");
    cy.get('[data-testid="send-email-btn"]').click();
    cy.wait("@sendEmail");

    cy.get('[data-testid="email-sent-confirm"]').should("contain", "mechanic@shop.com");
    cy.get('[data-testid="share-email-input"]').should("have.value", "");
  });
});

describe("Mechanic Printout — public report page", () => {
  it("renders the printout for a valid share token", () => {
    cy.intercept("GET", `**/report/${SHARE_TOKEN}`, {
      statusCode: 200,
      body: PRINTOUT_FIXTURE,
    }).as("getReport");

    cy.visit(`/report/${SHARE_TOKEN}`);
    cy.wait("@getReport");

    cy.get('[data-testid="printout-document"]').should("be.visible");
    cy.get('[data-testid="vehicle-display-name"]').should("contain", "The Daily");
    cy.get('[data-testid="vehicle-meta"]').should("contain", "Triumph");
    cy.get('[data-testid="stat-odometer"]').should("contain", "14,230");
    cy.get('[data-testid="stat-entry-count"]').should("contain", "1");
    cy.get('[data-testid="printout-entry"]').should("have.length", 1);
    cy.contains("Oil & filter change").should("be.visible");
    cy.get('[data-testid="entry-notes"]').should("contain", "Full synthetic");
  });

  it("shows the vehicle glyph when no photo is set", () => {
    cy.intercept("GET", `**/report/${SHARE_TOKEN}`, {
      statusCode: 200,
      body: PRINTOUT_FIXTURE,
    }).as("getReport");

    cy.visit(`/report/${SHARE_TOKEN}`);
    cy.wait("@getReport");

    cy.get('[data-testid="vehicle-glyph"]').should("be.visible");
    cy.get('[data-testid="vehicle-photo"]').should("not.exist");
  });

  it("shows the revoked state for an invalid or revoked token", () => {
    const badToken = "revoked-token-xyz";

    cy.intercept("GET", `**/report/${badToken}`, {
      statusCode: 404,
      body: { error: "Report not found" },
    }).as("getReport");

    cy.visit(`/report/${badToken}`);
    cy.wait("@getReport");

    cy.get('[data-testid="not-found-state"]').should("be.visible");
    cy.contains("This report is no longer available").should("be.visible");
  });
});
