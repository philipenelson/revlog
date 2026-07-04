const VEHICLE_ID = "the-daily-edit";
const ACCESS_TOKEN = "e2e-edit-vehicle-access-token";

const VEHICLE_FIXTURE = {
  id: VEHICLE_ID,
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: 2021,
  mileage: 14230,
  photoUrl: null,
  insurance: null,
  logEntries: [],
  stats: { totalSpent: "0.00", lastLoggedAt: null },
};

function stubDetailOk(override: object = {}) {
  cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
    statusCode: 200,
    body: { vehicle: { ...VEHICLE_FIXTURE, ...override } },
  }).as("getVehicle");
}

function stubPatchOk(override: object = {}) {
  cy.intercept("PATCH", `**/vehicles/${VEHICLE_ID}`, {
    statusCode: 200,
    body: { vehicle: { ...VEHICLE_FIXTURE, ...override } },
  }).as("patchVehicle");
}

function stubPhotoOk(photoUrl = "http://localhost:3001/uploads/vehicles/new-photo.jpg") {
  cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/photo`, {
    statusCode: 200,
    body: { photoUrl },
  }).as("uploadPhoto");
}

function selectPhotoFile() {
  cy.get('[data-testid="photo-input"]').selectFile(
    { contents: Cypress.Buffer.from("fake-image-bytes"), fileName: "bike.jpg", mimeType: "image/jpeg" },
    { force: true },
  );
}

function signIn(beforeVisit: () => void = () => {}) {
  cy.setCookie("refreshToken", "e2e-edit-vehicle-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("login");

  beforeVisit();

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("edit-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();
  cy.wait("@login");
}

/**
 * The second `cy.visit()` to /garage/[vehicleId]/edit wipes the in-memory
 * session (ADR 0016). Stub the silent restore so the page has a session to
 * fetch the vehicle with — same pattern as journey.cy.ts's jStubAuthRefresh.
 */
function stubEditVehicleAuthRefresh() {
  cy.intercept("POST", "**/auth/refresh", {
    statusCode: 200,
    body: {
      accessToken: ACCESS_TOKEN,
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ACTIVE" },
    },
  }).as("refresh");
}

describe("Edit Vehicle screen — /garage/[vehicleId]/edit", () => {
  it("pre-fills all fields from the vehicle detail", () => {
    signIn(stubDetailOk);
    stubEditVehicleAuthRefresh();
    cy.visit(`/garage/${VEHICLE_ID}/edit`);
    cy.wait("@refresh");
    cy.wait("@getVehicle");

    cy.get('[data-testid="nickname-input"]').should("have.value", VEHICLE_FIXTURE.nickname);
    cy.get('[data-testid="make-input"]').should("have.value", VEHICLE_FIXTURE.make);
    cy.get('[data-testid="model-input"]').should("have.value", VEHICLE_FIXTURE.model);
    cy.get('[data-testid="year-input"]').should("have.value", String(VEHICLE_FIXTURE.year));
    cy.get('[data-testid="mileage-input"]').should("have.value", String(VEHICLE_FIXTURE.mileage));
  });

  it("shows a loading skeleton while the vehicle data is fetching", () => {
    cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, (req) => {
      req.reply({ delay: 500, statusCode: 200, body: { vehicle: VEHICLE_FIXTURE } });
    }).as("slowGet");

    signIn();
    stubEditVehicleAuthRefresh();
    cy.visit(`/garage/${VEHICLE_ID}/edit`);
    cy.wait("@refresh");
    cy.get('[data-testid="loading-skeleton"]').should("exist");
    cy.wait("@slowGet");
    cy.get('[data-testid="edit-vehicle-form"]').should("exist");
  });

  describe("happy path — save changes", () => {
    it("calls PATCH and redirects to vehicle detail on save", () => {
      signIn(stubDetailOk);
      stubPatchOk({ make: "Yamaha", model: "MT-07" });
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="make-input"]').clear().type("Yamaha");
      cy.get('[data-testid="model-input"]').clear().type("MT-07");
      cy.get('[data-testid="save-btn"]').click();

      cy.wait("@patchVehicle").its("request.body").should((body) => {
        expect(body.make).to.equal("Yamaha");
        expect(body.model).to.equal("MT-07");
      });
      cy.url().should("include", `/garage/${VEHICLE_ID}`);
      cy.url().should("not.include", "/edit");
    });

    it("sends nickname as null when the nickname field is cleared", () => {
      signIn(stubDetailOk);
      stubPatchOk({ nickname: null });
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="nickname-input"]').clear();
      cy.get('[data-testid="save-btn"]').click();

      cy.wait("@patchVehicle").its("request.body").should((body) => {
        expect(body.nickname).to.be.null;
      });
    });

    it("shows loading state on save button while submitting", () => {
      signIn(stubDetailOk);
      cy.intercept("PATCH", `**/vehicles/${VEHICLE_ID}`, (req) => {
        req.reply({ delay: 400, statusCode: 200, body: { vehicle: VEHICLE_FIXTURE } });
      }).as("slowPatch");

      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");
      cy.get('[data-testid="save-btn"]').click();
      cy.get('[data-testid="save-btn"]').should("be.disabled");
      cy.wait("@slowPatch");
    });
  });

  describe("cancel", () => {
    it("navigates to vehicle detail on cancel without submitting", () => {
      signIn(stubDetailOk);
      stubDetailOk();

      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");
      cy.get('[data-testid="cancel-btn"]').click();

      cy.url().should("include", `/garage/${VEHICLE_ID}`);
      cy.url().should("not.include", "/edit");
    });
  });

  describe("client-side validation", () => {
    it("shows an error when make is empty", () => {
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="make-input"]').clear();
      cy.get('[data-testid="save-btn"]').click();

      cy.contains("Enter the manufacturer.").should("be.visible");
    });

    it("shows an error when year is invalid", () => {
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="year-input"]').clear().type("abcd");
      cy.get('[data-testid="save-btn"]').click();

      cy.contains("Enter a year between").should("be.visible");
    });
  });

  describe("API error on save", () => {
    it("shows an inline error when the PATCH returns a 4xx", () => {
      signIn(stubDetailOk);
      cy.intercept("PATCH", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 400,
        body: { error: "Validation error" },
      }).as("patchError");

      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");
      cy.get('[data-testid="save-btn"]').click();
      cy.wait("@patchError");

      cy.get('[data-testid="submit-error"]').should("be.visible");
    });
  });

  describe("not-found / error states", () => {
    it("renders not-found state when the initial GET returns 404", () => {
      cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 404,
        body: { error: "Vehicle not found" },
      });

      signIn();
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.contains("Vehicle not found").should("be.visible");
      cy.contains("Back to garage").should("be.visible");
    });

    it("renders not-found state when the initial GET returns 403", () => {
      cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 403,
        body: { error: "Forbidden" },
      });

      signIn();
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.contains("Vehicle not found").should("be.visible");
    });

    it("renders error state when the initial GET returns 500", () => {
      cy.intercept("GET", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 500,
        body: { error: "Internal server error" },
      });

      signIn();
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.contains("Something went wrong").should("be.visible");
    });
  });

  describe("photo change", () => {
    it("shows an empty placeholder when the vehicle has no photo", () => {
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="photo-zone"]').find("img").should("not.exist");
      cy.get('[data-testid="remove-photo-btn"]').should("not.exist");
    });

    it("shows the current photo when the vehicle has one", () => {
      signIn(() => stubDetailOk({ photoUrl: "http://localhost:3001/uploads/vehicles/current.jpg" }));
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="photo-zone"]').find("img").should("have.attr", "src").and("include", "current.jpg");
      // No pending pick yet — nothing to discard.
      cy.get('[data-testid="remove-photo-btn"]').should("not.exist");
    });

    it("shows a local preview and a remove-selection control once a replacement is picked", () => {
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      selectPhotoFile();

      cy.get('[data-testid="photo-zone"]').find("img").should("be.visible");
      cy.get('[data-testid="remove-photo-btn"]').should("be.visible");
    });

    it("discards the pending pick without calling the API when removed", () => {
      cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/photo`).as("uploadPhoto");
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      selectPhotoFile();
      cy.get('[data-testid="remove-photo-btn"]').click();

      cy.get('[data-testid="photo-zone"]').find("img").should("not.exist");
      cy.get('[data-testid="remove-photo-btn"]').should("not.exist");
      cy.get("@uploadPhoto.all").should("have.length", 0);
    });

    it("uploads the picked photo after a successful save and navigates to detail", () => {
      signIn(stubDetailOk);
      stubPatchOk();
      stubPhotoOk();
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      selectPhotoFile();
      cy.get('[data-testid="save-btn"]').click();

      cy.wait("@patchVehicle");
      cy.wait("@uploadPhoto").then(({ request }) => {
        expect(request.headers["content-type"]).to.include("multipart/form-data");
      });
      cy.url().should("include", `/garage/${VEHICLE_ID}`);
      cy.url().should("not.include", "/edit");
    });

    it("never calls the photo endpoint when no new photo was picked", () => {
      cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/photo`).as("uploadPhoto");
      signIn(stubDetailOk);
      stubPatchOk({ make: "Yamaha" });
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      cy.get('[data-testid="make-input"]').clear().type("Yamaha");
      cy.get('[data-testid="save-btn"]').click();

      cy.wait("@patchVehicle");
      cy.get("@uploadPhoto.all").should("have.length", 0);
    });

    it("shows an inline photo error and stays on the screen when the upload fails after a successful save", () => {
      signIn(stubDetailOk);
      stubPatchOk();
      cy.intercept("POST", `**/vehicles/${VEHICLE_ID}/photo`, {
        statusCode: 500,
        body: { error: "Internal server error" },
      }).as("uploadPhotoError");
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");

      selectPhotoFile();
      cy.get('[data-testid="save-btn"]').click();

      cy.wait("@patchVehicle");
      cy.wait("@uploadPhotoError");
      cy.get('[data-testid="submit-error"]').should("contain", "couldn't be uploaded");
      cy.url().should("include", "/edit");
    });
  });

  describe("delete vehicle", () => {
    function setup() {
      signIn(stubDetailOk);
      stubEditVehicleAuthRefresh();
      cy.visit(`/garage/${VEHICLE_ID}/edit`);
      cy.wait("@refresh");
      cy.wait("@getVehicle");
    }

    it("shows the danger zone after the vehicle loads", () => {
      setup();
      cy.get('[data-testid="danger-zone"]').should("be.visible");
      cy.get('[data-testid="delete-vehicle-btn"]').should("be.visible");
    });

    it("opens the confirmation dialog when Delete vehicle is clicked", () => {
      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-confirm-dialog"]').should("be.visible");
    });

    it("shows the vehicle display name in the dialog body", () => {
      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-confirm-dialog"]').should("contain", VEHICLE_FIXTURE.nickname);
    });

    it("closes the dialog on Cancel without sending a DELETE request", () => {
      cy.intercept("DELETE", `**/vehicles/${VEHICLE_ID}`).as("deleteRequest");

      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-cancel-btn"]').click();
      cy.get('[data-testid="delete-confirm-dialog"]').should("not.exist");
      cy.get("@deleteRequest.all").should("have.length", 0);
    });

    it("closes the dialog when clicking the backdrop", () => {
      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-confirm-dialog"]').click("topLeft");
      cy.get('[data-testid="delete-confirm-dialog"]').should("not.exist");
    });

    it("navigates to /garage after confirming delete", () => {
      cy.intercept("DELETE", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 204,
        body: null,
      }).as("deleteVehicle");

      cy.intercept("GET", "**/vehicles", {
        statusCode: 200,
        body: { vehicles: [] },
      }).as("listVehicles");

      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-confirm-btn"]').click();
      cy.wait("@deleteVehicle");
      cy.url().should("include", "/garage");
      cy.url().should("not.include", `/${VEHICLE_ID}`);
    });

    it("shows an inline error and keeps dialog open when DELETE fails", () => {
      cy.intercept("DELETE", `**/vehicles/${VEHICLE_ID}`, {
        statusCode: 500,
        body: { error: "Internal server error" },
      }).as("deleteVehicleError");

      setup();
      cy.get('[data-testid="delete-vehicle-btn"]').click();
      cy.get('[data-testid="delete-confirm-btn"]').click();
      cy.wait("@deleteVehicleError");
      cy.get('[data-testid="delete-error"]').should("be.visible");
      cy.get('[data-testid="delete-confirm-dialog"]').should("be.visible");
    });
  });
});
