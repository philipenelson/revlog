// Helpers for setting up real backend state via direct HTTP calls (not
// through the UI) so specs can test flows -- like logging in -- that
// require an already-existing, already-verified account. Appium has no
// network-interception layer like Cypress's cy.intercept(), so mobile E2E
// specs drive the real dev API + Mailpit rather than stubbing responses.

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

export interface TestUser {
  fullName: string;
  email: string;
  password: string;
}

interface MailpitMessageSummary {
  ID: string;
  To: Array<{ Address: string }>;
}

interface MailpitListResponse {
  messages: MailpitMessageSummary[];
}

export function uniqueTestUser(prefix: string): TestUser {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    fullName: 'E2E Test User',
    email: `${prefix}-${unique}@example.com`,
    password: 'E2eTest1pass',
  };
}

export async function registerViaApi(user: TestUser): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: user.fullName,
      email: user.email,
      password: user.password,
      confirmPassword: user.password,
    }),
  });
  if (!res.ok) {
    throw new Error(`registerViaApi(${user.email}) failed: ${res.status} ${await res.text()}`);
  }
}

async function findVerificationToken(email: string, attempts = 15): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const list = (await fetch(`${MAILPIT_URL}/api/v1/messages`).then((r) => r.json())) as MailpitListResponse;
    const match = list.messages.find((m) => m.To.some((t) => t.Address === email));
    if (!match) continue;

    const body = await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`).then((r) => r.text());
    const tokenMatch = body.match(/token=([a-f0-9-]{36})/);
    if (tokenMatch) return tokenMatch[1];
  }
  throw new Error(`Verification token for ${email} not found in Mailpit after ${attempts}s`);
}

export async function verifyEmailViaApi(email: string): Promise<void> {
  const token = await findVerificationToken(email);
  const res = await fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error(`verifyEmailViaApi(${email}) failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Registers + verifies a brand-new account via direct API calls, bypassing
 * the UI. Used to set up the LOGIN happy path, which needs an
 * already-verified account to sign in with.
 */
export async function createVerifiedUser(prefix: string): Promise<TestUser> {
  const user = uniqueTestUser(prefix);
  await registerViaApi(user);
  await verifyEmailViaApi(user.email);
  return user;
}

export async function loginViaApi(user: TestUser): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) {
    throw new Error(`loginViaApi(${user.email}) failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

export interface VehiclePayload {
  nickname?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

/**
 * Creates a Vehicle for the given (already-authenticated) account. Also the
 * only way to move a freshly-verified account's AccountStatus from
 * ONBOARDING to ACTIVE via API alone (see ADR 0015) -- required to reach
 * /garage at all, since routeForAccountStatus sends ONBOARDING accounts to
 * /onboarding instead.
 */
export async function createVehicleViaApi(accessToken: string, payload: VehiclePayload): Promise<string> {
  const res = await fetch(`${API_URL}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`createVehicleViaApi failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { vehicle: { id: string } };
  return body.vehicle.id;
}

export async function deleteVehicleViaApi(accessToken: string, vehicleId: string): Promise<void> {
  const res = await fetch(`${API_URL}/vehicles/${vehicleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`deleteVehicleViaApi(${vehicleId}) failed: ${res.status} ${await res.text()}`);
  }
}
