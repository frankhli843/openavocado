# Lesson Authoring Guide

This is the quality bar for generated Open Avocado lessons. It applies whether a lesson is written by a hosted model, a local model, an agent runtime, a queue worker, or a human author using scripts.

The machine-checked subset lives in `src/lib/lesson-generator/contract.ts`. This guide covers the judgment calls that validators cannot fully measure.

## Core Standard

A lesson must teach, not merely summarize. The learner should understand what changes, why it changes, and how to use the idea after the lesson.

Every normal lesson should include:

- a clear learning objective
- structured written explanation
- video-first teaching media or an explicit video-generation plan
- at least one meaningful visual or interactive artifact
- code practice when the topic can be modeled computationally
- assessment questions with concepts and difficulty
- next-lesson diagnostics
- tags and mastery targets

Audio-only output is legacy. Narration can be used as source material, but the learner-facing artifact should be a reviewed video or a media section with real visuals.

## Evidence First

Before choosing the next lesson, inspect the available evidence:

- subject title, goals, criteria, and learner profile
- completed lesson history
- discarded lessons and discard reasons
- quiz attempts and written diagnostics
- code submissions and test outcomes
- mastery signals, misconceptions, and weak spots
- uploaded materials or links provided by the learner

Do not invent learner weaknesses. If evidence is missing, generate a lesson that includes a diagnostic path rather than pretending certainty.

## Lesson Shape

Use a direct teaching arc:

1. Establish what the learner is trying to understand.
2. Introduce the smallest useful mental model.
3. Show the mechanism with a visual or simulation.
4. Work through a concrete example.
5. Let the learner manipulate or practice the idea.
6. Assess understanding.
7. Capture what the next lesson should repair or extend.

Avoid generic section labels as content. A lesson whose main value is "overview, practice, assessment" is too thin.

## Video And Visuals

A strong lesson shows the actual objects changing. Depending on the topic, that can mean tensors, queues, trees, budgets, state machines, API requests, legal clauses, timelines, maps, or decision tables.

For video-ready sections:

- write a storyboard before rendering
- align narration, captions, and visuals
- include poster frames and playback metadata
- verify playback in the browser
- keep generated media in runtime storage, not git

For technical animations, Manim is a good option. The key requirement is not the tool, it is that the visual explanation is specific and inspectable.

## Written Content

The `reading` section should stand alone. It should include definitions, worked examples, warnings, and a short summary. It must not be a transcript dump.

Good written sections:

- name the concept precisely
- show a concrete example
- explain the common mistake
- connect back to the learner goal
- leave a clear review summary

## Interactives

An interactive must let the learner change something meaningful and see a consequence. A static diagram is not an interactive.

Good interactives:

- expose one or two important controls
- show the result immediately
- have labels that explain the mechanism
- stay stable on mobile and desktop
- fail with a clear error if the spec is invalid

## Code Practice

Use code practice when a concept can be represented as a model, simulation, parser, transformation, decision rule, or test.

The exercise should include:

- prompt
- walkthrough
- input and output examples
- starter code
- public tests
- hidden tests
- progressive hints
- worked examples for study mode

Do not put a complete solution in a top-level field that the learner can accidentally see before trying.

## Assessment

Questions must carry concepts and difficulty. Multiple-choice questions should test understanding, not recognition of wording.

A useful assessment answer tells the generator something about the next lesson:

- strength
- weak spot
- misconception
- review needed
- ready to advance

The learner can pass a quiz and still need a targeted repair lesson if the evidence shows a fragile foundation.

## One-Off Lessons

A one-off lesson should cover the important material in one complete package. It should not begin with a separate assessment lesson unless the user explicitly asks for that.

When a user uploads documents or provides links for a one-off lesson, the author should extract the key learning goals, teach the important ideas, and cite or reference the provided materials in the lesson metadata where appropriate.

## Two-Lesson Readiness

For continuing subjects, keep the learner from waiting. After a lesson is completed, the generation workflow should ensure there are two ready lessons ahead when possible.

If one future lesson already exists, enrich it using evidence from the just-completed lesson instead of blindly generating another unrelated lesson.

## QA Checklist

Before a lesson becomes active, verify:

- generated content validates against the contract
- media artifacts exist and load
- video or visual sections teach the actual mechanism
- code practice runs and tests behave as expected
- quiz questions have concepts and difficulty
- next-lesson diagnostics exist
- mobile and desktop layout are usable
- no private learner data or deployment details appear

If any check fails, fix or regenerate the affected section before activation.

## Harness Requirement

If lesson generation is delegated to an external task system, the task should include this guide, the event payload, the validation command, and the expected completion evidence.

Do not depend on one private task tracker. Use the generic `agent-harness` or `webhook` adapter unless your deployment explicitly configures a custom adapter.
