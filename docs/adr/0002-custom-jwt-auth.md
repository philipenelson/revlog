# Custom JWT auth over NextAuth

NextAuth v5 (Auth.js) would be the obvious choice for a Next.js app, but it abstracts away the patterns interviewers actually ask about. Rolling fully custom would require building OAuth flows from scratch — high time cost, high testing burden. The middle ground: custom JWT auth using `jose` (signing/verification) and `bcrypt` (password hashing), credentials-only for V1. The auth layer is ~200–300 lines across the stack, fully owned and explainable, with no framework magic. Express middleware validates tokens; Next.js middleware does the same for page/route protection; React Native stores tokens in SecureStore.

## Status

accepted

## V2 consideration

Add OAuth (Google, Apple) on top of the existing JWT infrastructure. Evaluate whether Auth.js is worth pulling in just for the OAuth dance at that point, keeping the custom JWT layer underneath.
