const VEHICLE_DRAFT = {
  nickname: "The Daily",
  make: "Triumph",
  model: "Street Triple RS",
  year: "2021",
  mileage: "14230",
};

/**
 * Drives the real login form with `POST /auth/login` intercepted to return an
 * `ONBOARDING` account — this is what populates `AuthProvider`'s in-memory
 * session, which is the only thing that authorizes `POST /vehicles` and
 * `POST /onboarding/skip` (see ADR 0016 and garage.cy.ts's `signIntoGarage`,
 * which documents the same pattern for the same reason).
 */
function signIntoOnboarding() {
  cy.setCookie("refreshToken", "e2e-onboarding-session");

  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: {
      accessToken: "e2e-onboarding-access-token",
      user: { id: "e2e-user", accountId: "e2e-account", role: "OWNER" },
      account: { id: "e2e-account", status: "ONBOARDING" },
    },
  }).as("login");

  cy.visit("/login");
  cy.get('[data-testid="email-input"]').type("onboarding-e2e@example.com");
  cy.get('[data-testid="password-input"]').type("doesnt-matter-its-stubbed");
  cy.contains("button", "Continue").click();

  cy.wait("@login");
  cy.location("pathname").should("eq", "/onboarding");
}

function fillVehicleFields(draft: typeof VEHICLE_DRAFT) {
  if (draft.nickname) cy.get('[data-testid="nickname-input"]').type(draft.nickname);
  cy.get('[data-testid="make-input"]').type(draft.make);
  cy.get('[data-testid="model-input"]').type(draft.model);
  cy.get('[data-testid="year-input"]').type(draft.year);
  cy.get('[data-testid="mileage-input"]').type(draft.mileage);
}

// The garage screen fetches `GET /vehicles` on mount — stub it before any
// navigation that lands there so the destination renders predictably instead
// of firing an unhandled request against a fake access token.
function stubEmptyGarage() {
  cy.intercept("GET", "**/vehicles", { statusCode: 200, body: { vehicles: [] } }).as("getVehicles");
}

describe("Onboarding wizard", () => {
  describe("welcome step and vehicle form", () => {
    beforeEach(() => {
      // Middleware gates this route on the refresh-token cookie's presence only
      // (see ADR 0016) — these specs exercise client-side rendering and
      // validation only, neither of which reaches the network, so a real
      // session isn't needed here.
      cy.setCookie("refreshToken", "e2e-onboarding-session");
      cy.visit("/onboarding");
    });

    it("renders the welcome step with brand and step indicator at step 1", () => {
      cy.contains("Revlog").should("be.visible");
      cy.get('[data-testid="step-welcome"]').should("be.visible");
      cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "1");
      cy.get('[data-testid="add-first-vehicle-btn"]').should("be.visible");
      cy.get('[data-testid="skip-onboarding-btn"]').should("be.visible");
    });

    it("shows a validation error per empty or invalid field and clears it once corrected", () => {
      cy.get('[data-testid="add-first-vehicle-btn"]').click();
      cy.get('[data-testid="continue-btn"]').click();

      cy.get('[data-testid="step-vehicle"]').should("be.visible");
      cy.get('[data-testid="make-input"]')
        .siblings('[role="alert"]')
        .should("contain", "Enter the manufacturer.");
      cy.get('[data-testid="model-input"]')
        .siblings('[role="alert"]')
        .should("contain", "Enter the model.");
      cy.get('[data-testid="year-input"]')
        .siblings('[role="alert"]')
        .should("contain", "Enter a numeric year.");
      cy.contains("Enter the current mileage.").should("be.visible");

      cy.get('[data-testid="make-input"]').type("Triumph");
      cy.get('[data-testid="make-input"]').siblings('[role="alert"]').should("not.exist");
    });

    it("rejects a non-numeric year and mileage", () => {
      cy.get('[data-testid="add-first-vehicle-btn"]').click();
      cy.get('[data-testid="make-input"]').type("Triumph");
      cy.get('[data-testid="model-input"]').type("Street Triple RS");
      cy.get('[data-testid="year-input"]').type("not-a-year");
      cy.get('[data-testid="mileage-input"]').type("lots");
      cy.get('[data-testid="continue-btn"]').click();

      cy.contains("Enter a numeric year.").should("be.visible");
      cy.contains("Enter the current mileage.").should("be.visible");
      cy.get('[data-testid="step-vehicle"]').should("be.visible");
    });

    it("returns to the welcome step via Back without losing the skip option", () => {
      cy.get('[data-testid="add-first-vehicle-btn"]').click();
      cy.get('[data-testid="back-btn"]').click();

      cy.get('[data-testid="step-welcome"]').should("be.visible");
      cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "1");
      cy.get('[data-testid="skip-onboarding-btn"]').should("be.visible");
    });

    it("shows the optional photo zone in step 2", () => {
      cy.get('[data-testid="add-first-vehicle-btn"]').click();

      cy.get('[data-testid="photo-zone"]').should("be.visible");
      cy.get('[data-testid="photo-input"]').should("exist");
    });

    it("shows a thumbnail preview and remove button once a photo is selected, and clears on remove", () => {
      cy.get('[data-testid="add-first-vehicle-btn"]').click();

      cy.get('[data-testid="photo-input"]').selectFile({
        contents: Cypress.Buffer.from("fake-image-bytes"),
        fileName: "bike.jpg",
        mimeType: "image/jpeg",
      }, { force: true });

      cy.get('[data-testid="photo-zone"]').find("img").should("be.visible");
      cy.get('[data-testid="remove-photo-btn"]').should("be.visible");

      cy.get('[data-testid="remove-photo-btn"]').click();

      cy.get('[data-testid="photo-zone"]').find("img").should("not.exist");
      cy.get('[data-testid="remove-photo-btn"]').should("not.exist");
    });
  });

  describe("completing onboarding by adding a first vehicle", () => {
    beforeEach(() => {
      signIntoOnboarding();
      cy.get('[data-testid="add-first-vehicle-btn"]').click();
    });

    it("submits the draft to POST /vehicles, activates the account, and reaches the ready summary", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230 } },
      }).as("createVehicle");

      fillVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="continue-btn"]').click();

      cy.wait("@createVehicle").then(({ request }) => {
        expect(request.headers.authorization).to.eq("Bearer e2e-onboarding-access-token");
        expect(request.body).to.deep.equal({
          nickname: "The Daily",
          make: "Triumph",
          model: "Street Triple RS",
          year: 2021,
          mileage: 14230,
        });
      });

      cy.get('[data-testid="step-ready"]').should("be.visible");
      cy.get('[data-testid="step-indicator"]').should("have.attr", "data-active-step", "3");
      cy.get('[data-testid="ready-headline"]').should("contain", "The Daily");
      cy.get('[data-testid="vehicle-plate"]').within(() => {
        cy.contains("The Daily");
        cy.contains("Triumph Street Triple RS");
        cy.contains("2021");
        cy.contains("14230 mi");
      });

      stubEmptyGarage();
      cy.get('[data-testid="go-to-garage-btn"]').click();
      cy.location("pathname").should("eq", "/garage");
    });

    it("falls back to the make and model when no nickname is given, and omits it from the request", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", nickname: null, make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230 } },
      }).as("createVehicle");

      fillVehicleFields({ ...VEHICLE_DRAFT, nickname: "" });
      cy.get('[data-testid="continue-btn"]').click();

      cy.wait("@createVehicle").its("request.body").should("deep.equal", {
        make: "Triumph",
        model: "Street Triple RS",
        year: 2021,
        mileage: 14230,
      });

      cy.get('[data-testid="ready-headline"]').should("contain", "Triumph Street Triple RS");
      cy.get('[data-testid="vehicle-plate"]').within(() => {
        cy.contains("span", "Nickname").parent().contains("strong", "—");
      });
    });

    it("shows a pending state on Continue while the request is in flight", () => {
      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        delay: 500,
        body: { vehicle: { id: "v1", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230 } },
      }).as("createVehicle");

      fillVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="continue-btn"]').click();

      cy.get('[data-testid="continue-btn"]').should("contain", "Saving").and("be.disabled");
      cy.get('[data-testid="back-btn"]').should("be.disabled");

      cy.wait("@createVehicle");
      cy.get('[data-testid="step-ready"]').should("be.visible");
    });

    it("shows a user-facing error on a 4xx failure and recovers when retried", () => {
      cy.intercept("POST", "**/vehicles", { statusCode: 400, body: { error: "Invalid input" } }).as("createVehicle");

      fillVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="continue-btn"]').click();

      cy.wait("@createVehicle");
      cy.get('[data-testid="vehicle-save-error"]')
        .should("be.visible")
        .and("contain", "Couldn't save your vehicle");
      cy.get('[data-testid="step-vehicle"]').should("be.visible");

      cy.intercept("POST", "**/vehicles", {
        statusCode: 201,
        body: { vehicle: { id: "v1", nickname: "The Daily", make: "Triumph", model: "Street Triple RS", year: 2021, mileage: 14230 } },
      }).as("retryCreateVehicle");
      cy.get('[data-testid="continue-btn"]').click();

      cy.wait("@retryCreateVehicle");
      cy.get('[data-testid="vehicle-save-error"]').should("not.exist");
      cy.get('[data-testid="step-ready"]').should("be.visible");
    });

    it("shows a generic service error on a 5xx failure", () => {
      cy.intercept("POST", "**/vehicles", { statusCode: 500, body: { error: "Internal Server Error" } }).as("createVehicle");

      fillVehicleFields(VEHICLE_DRAFT);
      cy.get('[data-testid="continue-btn"]').click();

      cy.wait("@createVehicle");
      cy.get('[data-testid="vehicle-save-error"]')
        .should("be.visible")
        .and("contain", "We stalled");
      cy.get('[data-testid="step-vehicle"]').should("be.visible");
    });
  });

  describe("skipping onboarding", () => {
    beforeEach(() => {
      signIntoOnboarding();
    });

    it("calls POST /onboarding/skip, activates the account, and lands on the garage", () => {
      cy.intercept("POST", "**/onboarding/skip", { statusCode: 200, body: { status: "ACTIVE" } }).as("skipOnboarding");
      stubEmptyGarage();

      cy.get('[data-testid="skip-onboarding-btn"]').click();

      cy.wait("@skipOnboarding").its("request.headers.authorization").should("eq", "Bearer e2e-onboarding-access-token");
      cy.location("pathname").should("eq", "/garage");
    });

    it("shows a pending state while the skip request is in flight", () => {
      cy.intercept("POST", "**/onboarding/skip", { statusCode: 200, delay: 500, body: { status: "ACTIVE" } }).as("skipOnboarding");

      cy.get('[data-testid="skip-onboarding-btn"]').click();
      cy.get('[data-testid="skip-onboarding-btn"]').should("contain", "Skipping").and("be.disabled");

      cy.wait("@skipOnboarding");
    });

    it("shows a user-facing error on failure and recovers when retried", () => {
      cy.intercept("POST", "**/onboarding/skip", { statusCode: 401, body: { error: "Invalid or expired access token" } }).as("skipOnboarding");

      cy.get('[data-testid="skip-onboarding-btn"]').click();

      cy.wait("@skipOnboarding");
      cy.get('[data-testid="skip-error"]')
        .should("be.visible")
        .and("contain", "Couldn't skip onboarding");
      cy.get('[data-testid="step-welcome"]').should("be.visible");

      cy.intercept("POST", "**/onboarding/skip", { statusCode: 200, body: { status: "ACTIVE" } }).as("retrySkip");
      stubEmptyGarage();
      cy.get('[data-testid="skip-onboarding-btn"]').click();

      cy.wait("@retrySkip");
      cy.location("pathname").should("eq", "/garage");
    });
  });
});
