<div align="center">

<img src="site/assets/logo.svg" alt="Open Avocado" width="88" />

# Open Avocado

**Open-source adaptive learning platform and lesson-generation framework.**

[**Website &amp; Docs →**](https://frankhli843.github.io/openavocado/)

</div>

Open Avocado turns learning into an evidence-driven loop. A learner defines goals and subjects; every answer, code
submission, and quiz result becomes a mastery signal; and a pluggable lesson generator authors the single next lesson
that closes the most important gap — with narrated audio, bespoke interactives, scaffolded code, and adaptive
assessment. The goal is to move a learner from familiarity to competence to mastery.

## Quick start

```bash
pnpm install
mkdir -p data
pnpm db:migrate --seed     # first run only — seeds a local SQLite DB with synthetic data
pnpm dev                   # http://localhost:3000
```

Node 20–22 recommended. See the docs for the Node 25 caveat and how to choose a lesson-generation runtime.

## Documentation

Everything lives on the website — **<https://frankhli843.github.io/openavocado/>**:

- [Quick Start](https://frankhli843.github.io/openavocado/quickstart.html) — install, seed, run
- Run locally with: [a direct API key](https://frankhli843.github.io/openavocado/run-api-key.html) ·
  [Gemmaclaw](https://frankhli843.github.io/openavocado/run-gemmaclaw.html) ·
  [OpenClaw](https://frankhli843.github.io/openavocado/run-openclaw.html) ·
  [Hermes](https://frankhli843.github.io/openavocado/run-hermes.html)
- [Architecture](https://frankhli843.github.io/openavocado/architecture.html)
- [Lesson Authoring](https://frankhli843.github.io/openavocado/lesson-authoring.html)
- [Configuration](https://frankhli843.github.io/openavocado/configuration.html)
- [Contributing](https://frankhli843.github.io/openavocado/contributing.html)
- [Deployment](https://frankhli843.github.io/openavocado/deployment.html)
- [Privacy &amp; data boundaries](https://frankhli843.github.io/openavocado/privacy.html)

## Privacy

Personal data, credentials, generated media, SQLite databases, and local configuration stay out of git. Only
application code, schemas, generic prompts, tests, and clearly synthetic sample data are committed. See the
[privacy page](https://frankhli843.github.io/openavocado/privacy.html).

## License

See [`LICENSE`](LICENSE) once added. Until a license file is present, all rights are reserved by the repository owner.
