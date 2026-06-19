# AvocadoCore

Reusable adaptive learning dashboard and skill design.

AvocadoCore is intended to help a learner move from familiarity to competence to mastery across technical and non-technical subjects. It will use structured lesson history, assessments, code exercises, and review signals to generate the next lesson.

## Principles

- General platform first, private deployment second.
- SQLite-backed local source of truth.
- Autosave every meaningful interaction.
- Multi-user from day one.
- Generated lessons adapt from review needs, misunderstandings, and forward curriculum progress.
- Personal data, credentials, generated media, SQLite databases, and local configuration stay out of git.
- Generated audio is stored permanently in runtime storage.

## Planned Building Blocks

- Subject goals and editable learning objectives.
- Diagnostic intake before a new subject starts.
- Lesson queue, completed lesson history, and assessments.
- Audio walkthroughs.
- Interactive concept visualizations.
- Sandboxed Python exercises with syntax highlighting and tests.
- Mastery tracking, tags, and progress graphs over time.
- Next-lesson task generation.

## Stack

Next.js, React, and TypeScript.

## Local Data

Runtime data belongs in gitignored folders such as `data/`, `local_data/`, or `instance/`. Only synthetic fixtures should be committed.

## Project Notes

Deployment-specific planning notes should live outside this repo unless they are generic and safe to share.
