const MAILPIT_URL = "http://localhost:8025";
const PASSWORD = "correct horse battery staple 9";

describe("New owner journey", () => {
  let email: string;

  beforeEach(() => {
    // Each test reads its own freshly-sent verification email — start from a clean inbox.
    cy.request("DELETE", `${MAILPIT_URL}/api/v1/messages`);
  });

  it("registers, verifies via the emailed link, and lands in onboarding", () => {
    email = `journey-${Date.now()}@example.com`;

    cy.visit("/login");
    cy.get('[data-testid="register-tab"]').click();
    cy.get('[data-testid="name-input"]').type("Jordan Reyes");
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(PASSWORD);
    cy.get('[data-testid="confirm-password-input"]').type(PASSWORD);
    cy.contains("button", "Create account").click();

    // Registration redirects to the waiting screen — no token yet, nothing's been clicked
    cy.location("pathname").should("eq", "/verify-email");
    cy.get('[data-testid="verify-waiting"]').should("contain", email);

    // Cypress can't drive a real mail client to "click" the link, so this is the
    // realistic equivalent: read the token Mailpit received and visit the URL that
    // clicking the link would produce — a real navigation to /verify-email?token=...
    fetchVerificationToken(email).then((token) => {
      cy.visit(`/verify-email?token=${token}`);
    });

    cy.location("pathname", { timeout: 10000 }).should("eq", "/onboarding");
    cy.get('[data-testid="step-welcome"]').should("be.visible");
  });

  it("signs the same not-yet-onboarded account back into onboarding", () => {
    // Drop the session the previous test obtained — simulates a fresh sign-in
    cy.clearCookies();

    cy.visit("/login");
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(PASSWORD);
    cy.contains("button", "Continue").click();

    cy.location("pathname", { timeout: 10000 }).should("eq", "/onboarding");
    cy.get('[data-testid="step-welcome"]').should("be.visible");
  });

  it("redirects unauthenticated visits to onboarding and garage back to the login screen", () => {
    cy.clearCookies();

    cy.visit("/onboarding");
    cy.location("pathname").should("eq", "/login");

    cy.visit("/garage");
    cy.location("pathname").should("eq", "/login");
  });
});

/**
 * Polls Mailpit's REST API for the verification email sent to `email` and pulls the
 * `?token=` value out of its body. Registration awaits the SMTP send before responding,
 * so the message is normally there immediately — the retry just absorbs Mailpit's own
 * ingest latency without hardcoding a fixed wait.
 */
function fetchVerificationToken(email: string, attempt = 0): Cypress.Chainable<string> {
  return cy
    .request("GET", `${MAILPIT_URL}/api/v1/messages?query=${encodeURIComponent(`to:${email}`)}`)
    .then(({ body }) => {
      const message = body.messages?.[0];
      if (!message) {
        if (attempt >= 10) throw new Error(`No verification email arrived for ${email}`);
        cy.wait(300);
        return fetchVerificationToken(email, attempt + 1);
      }

      return cy.request("GET", `${MAILPIT_URL}/api/v1/message/${message.ID}`).then(({ body }) => {
        const match = /token=([A-Za-z0-9_-]{36})/.exec(body.Text ?? "");
        expect(match, "verification token in the email body").to.not.equal(null);
        return match![1];
      });
    });
}
