# Phase 11 — AI Engine (full)

Landed on top of the existing `AiEngine` + `RagService`:

- `HashEmbeddings` — deterministic 384-dim hashed BoW embedder. Zero external deps; usable in tests and offline dev. Swap for OpenAI/Gemini/Voyage in prod by rebinding `EmbeddingsProvider` in `AiModule`.
- `MemoryVectorStore` — in-memory cosine-similarity store implementing `VectorStore`; namespace scoped per user (`{userId}:{namespace}`) with wipe + introspection.
- `EvalService` — golden-set replay harness. Datasets are named collections of `{ prompt, expected|contains|regex, scorer }` cases; runs score against the current AI configuration and track per-case latency + pass rate.
- `AiEngineController` — `/ai/engine/rag/{index,query,namespaces}` and `/ai/engine/eval/{datasets,runs,run}` behind JWT.
- Web `AI Engine` page (`rag`, `eval` tabs) wired into the sidebar under "AI Engine".

Provider registry: `AiEngine.register(name, provider)` remains the plug point
for real OpenAI/Anthropic/Ollama providers (already implemented in
`providers/ai/*.ts`). Startup wiring should register those before serving
traffic; the eval harness picks providers via `model` routing on `matches(model)`.
