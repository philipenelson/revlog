# GitHub over GitLab for source hosting and CI/CD

GitLab has better CI/CD tooling and a more generous free tier for private repos. GitHub is chosen because the immediate priority is job-search visibility: hiring managers check GitHub profiles, contribution graphs matter as a hiring signal, and job postings asking for a profile link mean GitHub specifically. Public repositories on GitHub also get unlimited Actions minutes at no cost, which removes the CI budget constraint entirely for this project.

## Status

accepted

## Consequences

- Repository must be public to get unlimited Actions minutes and to serve its portfolio purpose
- No secrets may be committed; all environment variables go through GitHub Secrets
- Commit quality and graph consistency are now visible to potential employers
