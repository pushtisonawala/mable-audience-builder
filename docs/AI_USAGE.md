# How I used AI

I used **Claude Code** (model: Claude Opus 5.5) as my coding partner on this project. The brief allows AI tools, and I want to be clear about how I used it.

## What I used it for

- **Planning.** Before any code, I used it to break the brief into small steps and to compare options: Go or TypeScript for the backend, how to store time, and how to find users who bought nothing.
- **Research and learning.** When something was new to me, I asked it to explain using real examples from our own data until I understood it. For example: how the 7-day window works, why we start from all users, and how the database counts events.
- **Checking.** It ran the tests, broke one line on purpose to prove the tests would catch it, and clicked through the app in a browser, including turning the backend off to test the error and Retry screen.

## What I did

- Chose TypeScript for both apps and approved the plan before we started.
- Read every step, asked questions until I could explain it myself, and committed and pushed each step.
- Added my own test user (`anon_1014`). My first version had the dates outside the window; I fixed it after review and re-ran the tests.
- Checked the results by hand against the table of test users.

