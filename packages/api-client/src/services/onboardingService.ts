import type { HttpClient } from '../HttpClient';

export async function skipOnboarding(client: HttpClient): Promise<void> {
  await client.post('/onboarding/skip');
}
