# AI Native Visual Engine Spec

## 1. Document Purpose

This specification defines an implementation-ready architecture for an AI-native visual editor engine.

Target product characteristics:

- AI Native
- Low Code
- Dashboard Builder
- Visual Editor
- Multi Page
- Scene Graph Driven

Target capabilities:

- AI generate pages
- AI modify existing pages
- drag and drop layout editing
- multi-page dashboard and route management
- collaboration
- undo and redo
- runtime renderer
- plugin system

This is not a marketing document. It is an engineering specification used to guide system design, implementation, review, and milestone acceptance.

## 2. Design Goals

The engine must satisfy the following design goals:

1. `SceneGraph` is the only source of truth for page structure and visual state.
2. AI cannot mutate the scene directly. AI may only produce semantic intent.
3. Runtime mutations must be deterministic, replayable, and reversible.
4. Renderer is pure with respect to scene data. Renderer can derive UI but cannot mutate scene state.
5. Core engine must be extensible through component and behavior plugins.
6. Multi-page documents must be first-class rather than bolted on later.
7. Editing interactions, history, collaboration, and rendering must all share the same runtime mutation model.

## 3. Non Goals

The following are explicitly out of scope for the MVP unless later phases add them:

- full app backend generation
- arbitrary business workflow orchestration
- direct AI generation of raw scene JSON
- pixel-perfect design tool parity with Figma
- unrestricted custom code execution inside the editor core

## 4. System Layers

The system is divided into the following layers:

```text
AI
  -> Semantic Actions
  -> Semantic Compiler
  -> Runtime Actions
  -> Command Bus
  -> Middleware
  -> Runtime Handlers
  -> Scene Graph
  -> Renderer
```

Layer responsibilities:

1. `AI`
   Produces high-level intent and tool-call arguments.

2. `Semantic Actions`
   Represent user intent in domain language such as `create-dashboard` or `insert-chart`.

3. `Semantic Compiler`
   Converts semantic intent into a validated plan and then into runtime actions.

4. `Runtime Actions`
   Represent atomic, deterministic mutations against the scene graph.

5. `Command Bus`
   Dispatches runtime actions through middleware and handlers.

6. `Middleware`
   Performs logging, validation, history, and collaboration processing.

7. `Runtime Handlers`
   Apply action-specific mutations to the scene graph.

8. `Scene Graph`
   Holds the current authoritative page state.

9. `Renderer`
   Renders the scene graph into React tree, DOM, canvas, or another target.

## 5. Source of Truth Rules

The following rules are mandatory:

1. `SceneGraph` stores page structure, node hierarchy, layout state, visibility, props, runtime metadata, selection, and viewport.
2. React local state may exist for ephemeral UI concerns only, such as hover state, open popovers, or temporary drag preview.
3. Persistent editor state must not be represented only in component-local state.
4. Any state that must survive reload, replay, undo, redo, collaboration sync, or renderer switch must live in the scene graph or a document-level state model.

## 6. Main Domain Objects

The core domain objects are:

- `Document`: multi-page container and top-level asset/theme/variable owner
- `Page`: routeable unit mapped to a scene
- `SceneGraph`: authoritative state of one page scene
- `SceneNode`: node in the scene hierarchy
- `RuntimeAction`: atomic scene mutation
- `SemanticAction`: high-level user or AI intent

Refer to the following documents for details:

- `domain-model.md`
- `runtime-engine.md`
- `semantic-system.md`
- `plugin-system.md`
- `editor-interaction.md`
- `constraints-and-validation.md`
- `roadmap.md`
- `open-questions.md`

## 7. Core Invariants

The engine must preserve these invariants at all times:

1. Every `SceneNode.id` is globally unique within a scene.
2. Every non-root node has exactly one valid `parentId`.
3. Parent `children[]` ordering is the rendered order unless a renderer-specific override is explicitly defined.
4. A node cannot appear in multiple parent `children[]` collections.
5. `rootId` must reference an existing root node.
6. Actions either apply successfully and produce a new valid state, or fail without partial mutation.
7. Runtime handlers cannot silently coerce invalid structure; they must either normalize predictably or reject through validation.

## 8. Recommended Repository Layout

```text
src/
  core/
    scene/
    runtime/
    compiler/
    semantic/
    constraints/
    middleware/
    plugins/
    layout/
  renderer/
  ai/
  editor/
  components/
docs/
  spec/
```

Module boundary rules:

1. `core/scene` defines data structures and pure scene utilities.
2. `core/runtime` defines actions, handlers, command bus, and history contracts.
3. `core/compiler` defines semantic compilation and planning.
4. `core/plugins` defines extension interfaces and registries.
5. `renderer` depends on `core`, but `core` must not depend on renderer implementations.
6. `editor` depends on `core` and `renderer`, and owns editing UI only.
7. `ai` depends on semantic contracts and tool-call integration, not direct scene mutation APIs.

## 9. Suggested Delivery Order

The recommended implementation order is:

1. Scene graph model
2. Runtime action model and handler pipeline
3. React renderer
4. Grid and selection interactions
5. Semantic actions and compiler
6. Constraint system
7. AI tool-calling integration
8. Collaboration

See `roadmap.md` for detailed phase definitions and acceptance criteria.
