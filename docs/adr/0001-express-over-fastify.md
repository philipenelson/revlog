# Express.js over Fastify for the backend

The original tech stack specified Fastify — better engineered, native TypeScript, faster. Express.js was chosen instead because the immediate priority is landing a frontend/fullstack job: Express appears in the overwhelming majority of Node.js job postings, and demonstrating Express competency is a clearer signal to most interviewers than Fastify. Business logic lives in framework-agnostic services; route handlers stay thin. If the migration is ever worth doing, it's a routing-layer rewrite with no business logic changes.

## Status

accepted

## V2 consideration

Migrate backend from Express.js to Fastify once the job-search constraint is no longer the primary driver.
