const ADD_VEHICLE_DRAFT = {
  make: "Triumph",
  model: "Street Triple RS",
  year: "2021",
  mileage: "14230",
};

/**
 * Drives the real login form with stubbed endpoints to reach `/garage/add`
 * with an in-memory session — same pattern as garage.cy.ts.
 */
function signIntoAddVehicle() {
  cy.setCookie("refreshToken", "e2e-add-vehicle-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: "e2e-add-vehicle-access-token",
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("add-vehicle-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();

  cy.wait("@login");
  cy.location("pathname").should("eq", "/garage");
}

function stubAddVehicleEmptyGarage() {
  cy.intercept("GET", "**/vehicles", { statusCode: 200, body: { vehicles: [] } }).as("getVehicles");
}

function fillAddVehicleFields(draft: typeof VEHICLE_DRAFT & { nickname?: string }) {
  if (draft.nickname) cy.get('[data-testid="nickname-input"]').type(draft.nickname);
  cy.get('[data-testid="make-input"]').type(draft.make);
  cy.get('[data-testid="model-input"]').type(draft.model);
  cy.get('[data-testid="year-input"]').type(draft.year);
  cy.get('[data-testid="mileage-input"]').type(draft.mileage);
}

describe("Add vehicle screen (/garage/add)", () => {
  describe("page structure", () => {
    beforeEach(() => {
      cy.setCookie("refreshToken", "e2e-add-vehicle-session");
      cy.visit("/garage/add");
    });

    it("renders the brand, back link, page title, and form", () => {
      cy.contains("Revlog").should("be.visible");
      cy.contains("a", "Back to garage").should("have.attr", "href", "/garage");
      cy.contains("h1", "Add a vehicle").should("be.visible");
      cy.get('[data-testid="make-input"]').should("be.visible");
      cy.get('[data-testid="model-input"]').should("be.visible");
      cy.get('[data-testid="year-input"]').should("be.visible");
      cy.get('[data-testid="mileage-input"]').should("be.visible");
      cy.get('[data-testid="photo-zone"]').should("be.visible");
      cy.get('[data-testid="add-vehicle-btn"]').should("be.visible").and("contain", "Add vehicle");
    });

    it("live preview shows 'Make Model' as placeholder before any input", () => {
      cy.contains("Make Model").should("be.visible");
    });

    it("live preview updates as fields are filled in", () => {
      cy.get('[data-testid="make-input"]').type("Triumph");
      cy.get('[data-testid="model-input"]').type("Street Triple RS");
      cy.contains("Triumph · Street Triple RS").should("be.visible");

      cy.get('[data-testid="mileage-input"]').type("14230");
      cy.contains("14,230").should("be.visible");
    });
  });

  describe("field validation", () => {
    beforeEach(() => {
      cy.setCookie("refreshToken", "e2e-add-vehicle-session");
      cy.visit("/garage/add");
    });

    it("shows required-field errors for make, model, year, and mileage when submitted empty", () => {
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.get('[data-testid="make-input"]').siblings('[role="alert"]').should("contain", "Enter the manufacturer.");
      cy.get('[data-testid="model-input"]').siblings('[role="alert"]').should("contain", "Enter the model.");
      cy.contains("Enter a year between").should("be.visible");
      cy.contains("Enter the current mileage.").should("be.visible");
    });

    it("clears the error for a field once it is corrected", () => {
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.get('[data-testid="make-input"]').siblings('[role="alert"]').should("be.visible");
      cy.get('[data-testid="make-input"]').type("Triumph");
      cy.get('[data-testid="make-input"]').siblings('[role="alert"]').should("not.exist");
    });

    it("rejects an out-of-range year", () => {
      fillAddVehicleFields({ ...VEHICLE_DRAFT, year: "1776" });
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.contains("Enter a year between").should("be.visible");
    });
  });

  describe("happy path — no photo", () => {
    beforeEach(() => {
      signIntoAddVehicle();
      stubAddVehicleEmptyGarage();
      cy.wait("@getVehicles");
      cy.visit("/garage/add");
    });

    it("submits to POST /vehicles with correct JSON and redirects to /garage on success", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, nickname: null } },
      }).as("createVehicle");

      stubAddVehicleEmptyGarage();
      fillAddVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@createVehicle").then(({ request }) => {
        expect(request.headers.authorization).to.eq("Bearer e2e-add-vehicle-access-token");
        expect(request.body).to.deep.equal({ make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230 });
      });

      cy.location("pathname").should("eq", "/garage");
    });

    it("sends nickname when provided", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, nickname: "The Daily" } },
      }).as("createVehicle");

      stubAddVehicleEmptyGarage();
      fillAddVehicleFields({ ...VEHICLE_DRAFT, nickname: "The Daily" });
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@createVehicle").its("request.body").should("deep.include", { nickname: "The Daily" });
    });

    it("shows a pending state while the request is in flight", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        delay: 500,
        body: { vehicle: { id: "v1", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, nickname: null } },
      }).as("createVehicle");

      fillAddVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.get('[data-testid="add-vehicle-btn"]').should("be.disabled").and("contain", "Saving");
      cy.wait("@createVehicle");
    });
  });

  describe("happy path — with photo", () => {
    beforeEach(() => {
      signIntoAddVehicle();
      stubAddVehicleEmptyGarage();
      cy.wait("@getVehicles");
      cy.visit("/garage/add");
    });

    it("submits as multipart/form-data when a photo file is attached", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: "http://localhost:3001/uploads/vehicles/bike.jpg", nickname: null } },
      }).as("createVehicle");

      stubAddVehicleEmptyGarage();

      cy.get('[data-testid="photo-input"]').selectFile({
        contents: Cypress.Buffer.from("fake-image-bytes"),
        fileName: "bike.jpg",
        mimeType: "image/jpeg",
      }, { force: true });

      fillAddVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@createVehicle").then(({ request }) => {
        expect(request.headers["content-type"]).to.include("multipart/form-data");
      });

      cy.location("pathname").should("eq", "/garage");
    });

    it("shows a photo thumbnail preview and a remove button once a file is selected", () => {
      cy.get('[data-testid="photo-input"]').selectFile({
        contents: Cypress.Buffer.from("fake-image-bytes"),
        fileName: "bike.jpg",
        mimeType: "image/jpeg",
      }, { force: true });

      cy.get('[data-testid="photo-zone"]').find("img").should("be.visible");
      cy.get('[data-testid="remove-photo-btn"]').should("be.visible");
    });

    it("removes the photo preview when the remove button is clicked", () => {
      cy.get('[data-testid="photo-input"]').selectFile({
        contents: Cypress.Buffer.from("fake-image-bytes"),
        fileName: "bike.jpg",
        mimeType: "image/jpeg",
      }, { force: true });

      cy.get('[data-testid="remove-photo-btn"]').click();

      cy.get('[data-testid="photo-zone"]').find("img").should("not.exist");
      cy.get('[data-testid="remove-photo-btn"]').should("not.exist");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      signIntoAddVehicle();
      stubAddVehicleEmptyGarage();
      cy.wait("@getVehicles");
      cy.visit("/garage/add");
    });

    it("shows a user-facing error on a 4xx API failure and recovers when retried", () => {
      cy.intercept("POST", "**/vehicles", { statusCode: 400, body: { error: "Invalid input" } }).as("createVehicle");

      fillAddVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@createVehicle");
      cy.get('[data-testid="submit-error"]')
        .should("be.visible")
        .and("contain", "Couldn't save your vehicle");

      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230, photoUrl: null, nickname: null } },
      }).as("retryCreate");
      stubAddVehicleEmptyGarage();
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@retryCreate");
      cy.get('[data-testid="submit-error"]').should("not.exist");
      cy.location("pathname").should("eq", "/garage");
    });

    it("shows a generic service error on a 5xx failure", () => {
      cy.intercept("POST", "**/vehicles", { statusCode: 500, body: { error: "Internal Server Error" } }).as("createVehicle");

      fillAddVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="add-vehicle-btn"]').click();

      cy.wait("@createVehicle");
      cy.get('[data-testid="submit-error"]').should("be.visible").and("contain", "We stalled");
    });
  });
});
