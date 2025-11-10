

## USER

not yet. now I'd like you to web search and research a bit harder on bmad method. look at their agents and stages. dont worry about their alpha version 6 probably want to stick with v4. they have various ageants to brainstorm, create tech arch docs prd's features stories. do a deep dive on that, look at what they say is optional and what they recommend. lay out their in depth perspective on it. dont give me a bunch of examples or anything just solid description of the phases/stages/roles-agents/artifacts and what they consider the important ones and which can be skipped. not saying we'll do all this, but want to indulge a little exploration before nailing down a format and getting back at it


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01XmUFVvsohfQLDfEP3Vut8A)
{
  "query": "builder methods agent os bmad method spec driven development"
}
```


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_016KXRcFf3Kzs3TjamCBigm6)
{
  "query": "\"builder methods\" \"agent os\" v4 stages phases workflow"
}
```


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01X6cemtLGhmsm6dTBsEcVMz)
{
  "query": "brian casel agent os specification workflow agents roles artifacts"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01X6cemtLGhmsm6dTBsEcVMz",
    "type": "tool_result",
    "content": "Web search results for query: \"brian casel agent os specification workflow agents roles artifacts\"\n\nLinks: [{\"title\":\"Agent OS | The system for spec-driven development with AI coding agents\",\"url\":\"https://buildermethods.com/agent-os\"},{\"title\":\"GitHub - buildermethods/agent-os: Agent OS is a system for better planning and executing software development tasks with your AI agents.\",\"url\":\"https://github.com/buildermethods/agent-os\"},{\"title\":\"Agent OS Workflow for Spec-Driven Development\",\"url\":\"https://buildermethods.com/agent-os/workflow\"},{\"title\":\"Brian Casel on X: \\\"Agent OS now comes with 5 subagents for Claude Code, built-in. It's way more efficient at creating specs and following them. context-fetcher file-creator test-runner git-workflow date-checker https://t.co/eCu1A7cyd2\\\" / X\",\"url\":\"https://x.com/CasJam/status/1951682269187338398\"},{\"title\":\"Builder Methods | Training, Community, & Resources for AI-first software developers\",\"url\":\"https://buildermethods.com/\"},{\"title\":\"agent-os by buildermethods - SourcePulse\",\"url\":\"https://www.sourcepulse.org/projects/10595600\"},{\"title\":\"3-Layer Context in Agent OS\",\"url\":\"https://buildermethods.com/agent-os/3-layer-context\"},{\"title\":\"GitHub - Mugiwara555343/cursor-coding-agent-os: Agent OS is a system for better planning and executing software development tasks with your AI agents.\",\"url\":\"https://github.com/Mugiwara555343/cursor-coding-agent-os\"},{\"title\":\"Brian Casel on X: \\\"Shipped Agent OS v1.4.1. Major updates! ✔︎ Project types with coding standards for each. ✔︎ New 'project-manager' subagent for Claude Code ✔︎ Improved task execution & verification ✔︎ New install flow that's more project-centric. Better for teams. ✔︎ Docs updated.\\\" / X\",\"url\":\"https://x.com/CasJam/status/1957778526309900638\"},{\"title\":\"Brian Casel (@CasJam) / X\",\"url\":\"https://x.com/casjam?lang=en\"}]\n\nI found comprehensive information about Brian Casel's Agent OS and its specification workflow system. Here are the key findings:\n\n## Overview\nAgent OS is a spec-driven development system that gives AI agents the structured context they need to write production-quality code.(no content)Created by Brian Casel (that's me).\n\n## Workflow Commands\nAgent OS uses a structured workflow with specific commands:\n\n1. **write-spec**: The write-spec command transforms your requirements into a detailed specification document.\n\n2. **create-tasks**: The create-tasks command breaks down your spec into an actionable task list, grouped, prioritized, and ready for implementation.\n\n3. **implement-tasks**: The implement-tasks command provides simple, straightforward implementation with your main agent. Perfect for smaller features or when you want direct control.\n\n4. **orchestrate-tasks**: The orchestrate-tasks command provides advanced orchestration for complex features. Delegate task groups to specialized Claude Code subagents or generate targeted prompts with fine-grain control over context and standards.\n\n## Agents and Roles\nAgent OS now comes with 5 subagents for Claude Code, built-in. The subagents include: context-fetcher, file-creator, test-runner, git-workflow, and date-checker.\n\n## 3-Layer Context System\nAgent OS organizes your development knowledge into three distinct layers of context. Each layer serves a specific purpose and gets injected at different points in your workflow, ensuring your AI agents have exactly the right information at the right time.\n\nThe three layers are:\n- **Standards**: How you build (conventions, patterns, best practices)\n- **Product**: What you're building and why (mission, vision, roadmap)\n- **Specs**: What to build next (detailed feature specifications)"
  }
]


## USER

[
  {
    "tool_use_id": "toolu_01XmUFVvsohfQLDfEP3Vut8A",
    "type": "tool_result",
    "content": "Web search results for query: \"builder methods agent os bmad method spec driven development\"\n\nLinks: [{\"title\":\"GitHub - bmad-code-org/BMAD-METHOD: Breakthrough Method for Agile Ai Driven Development\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD\"},{\"title\":\"The BMAD Method: A Framework for Spec Oriented AI-Driven Development - GMOインターネットグループ グループ研究開発本部\",\"url\":\"https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/\"},{\"title\":\"Spec-driven AI coding: Spec-kit, BMAD, Agent OS and Kiro | by Tim Wang | Oct, 2025 | Medium\",\"url\":\"https://medium.com/@tim_wang/spec-kit-bmad-and-agent-os-e8536f6bf8a4\"},{\"title\":\"Agent OS | The system for spec-driven development with AI coding agents\",\"url\":\"https://buildermethods.com/agent-os\"},{\"title\":\"Comprehensive Guide to Spec-Driven Development Kiro, GitHub Spec Kit, and BMAD-METHOD | by Vishal Mysore | Sep, 2025 | Medium\",\"url\":\"https://medium.com/@visrow/comprehensive-guide-to-spec-driven-development-kiro-github-spec-kit-and-bmad-method-5d28ff61b9b1\"},{\"title\":\"BMad Code | AI Agent Framework [BMad Method]\",\"url\":\"https://bmadcodes.com/\"},{\"title\":\"GitHub - oimiragieo/BMAD-SPEC-KIT: Breakthrough Method for Agile Ai Driven Development integrating Github Spec driven framework.\",\"url\":\"https://github.com/oimiragieo/BMAD-SPEC-KIT\"},{\"title\":\"Agent OS Workflow for Spec-Driven Development\",\"url\":\"https://buildermethods.com/agent-os/workflow\"},{\"title\":\"What is BMAD-METHOD™? A Simple Guide to the Future of AI-Driven Development | by Vishal Mysore | Medium\",\"url\":\"https://medium.com/@visrow/what-is-bmad-method-a-simple-guide-to-the-future-of-ai-driven-development-412274f91419\"},{\"title\":\"Releases · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/releases\"}]\n\nI found several comprehensive resources about BMAD Method, Agent OS, and spec-driven development. Here are the key findings:\n\n## BMAD Method\n\nBMAD stands for \"Breakthrough Method for Agile AI-Driven Development\" and employs a sophisticated team of specialized AI agents, each with distinct roles, commands, and artifact outputs.(no content)The BMAD Method offers a solution by introducing a structured, spec-driven development framework.(no content)BMad-CORE (Collaboration Optimized Reflection Engine) amplifies human potential through specialized AI agents.(no content)You can use BMad Builder to create custom agents, workflows, and modules for any domain—software development, business strategy, creativity, learning, and more.\n\n## Agent OS (Builder Methods)\n\nAgent OS is a popular system spec-driven development with AI coding agents. It's a free open-source framework from Builder Methods, created by Brian Casel.(no content)Agent OS is a spec-driven development system that gives AI agents the structured context they need to write production-quality code. It provides your AI with clear specifications, standards, and workflows—transforming inconsistent outputs into reliable, production-ready implementations.\n\n## Key Differences\n\nWhile Spec Kit focuses specifically on software spec-to-code workflows, BMAD is a broader multi-agent orchestration framework that works across domains.(no content)If you need to build and manage complex multi-agent workflows that can integrate with different AI coding tools and are not limited to a specific development methodology, AgentOS from Builder Methods provides the underlying server and framework.\n\nBoth systems work with popular AI coding tools including Claude Code, Cursor, VS Code, and others."
  }
]


## USER

[
  {
    "tool_use_id": "toolu_016KXRcFf3Kzs3TjamCBigm6",
    "type": "tool_result",
    "content": "Web search results for query: \"\"builder methods\" \"agent os\" v4 stages phases workflow\"\n\nLinks: [{\"title\":\"Agent OS Workflow for Spec-Driven Development\",\"url\":\"https://buildermethods.com/agent-os/workflow\"},{\"title\":\"Agent OS | The system for spec-driven development with AI coding agents\",\"url\":\"https://buildermethods.com/agent-os\"},{\"title\":\"GitHub - buildermethods/agent-os: Agent OS is a system for better planning and executing software development tasks with your AI agents.\",\"url\":\"https://github.com/buildermethods/agent-os\"},{\"title\":\"Builder Methods · GitHub\",\"url\":\"https://github.com/buildermethods\"},{\"title\":\"Spec-driven AI coding: Spec-kit, BMAD, Agent OS and Kiro | by Tim Wang | Oct, 2025 | Medium\",\"url\":\"https://medium.com/@tim_wang/spec-kit-bmad-and-agent-os-e8536f6bf8a4\"},{\"title\":\"Implementing Tasks with Agent OS\",\"url\":\"https://buildermethods.com/agent-os/implement-tasks\"},{\"title\":\"3-Layer Context in Agent OS\",\"url\":\"https://buildermethods.com/agent-os/3-layer-context\"},{\"title\":\"How to Install Agent OS\",\"url\":\"https://buildermethods.com/agent-os/installation\"},{\"title\":\"GitHub - Mugiwara555343/cursor-coding-agent-os: Agent OS is a system for better planning and executing software development tasks with your AI agents.\",\"url\":\"https://github.com/Mugiwara555343/cursor-coding-agent-os\"}]\n\nI found information about **Agent OS** from Builder Methods. Here's what the search revealed:\n\n## Overview\nAgent OS is a spec-driven development system that gives AI agents the structured context they need to write production-quality code.(no content)It was created by Brian Casel and is the system for spec-driven development with AI.\n\n## Six-Phase Workflow\nAgent OS is designed to help you power your spec-driven development process with six development phases:\n\n**Phase 1 (One-time setup):**\n- The plan-product command kicks off this essential first phase. It is typically run only once at the beginning a new project, or on the day you install Agent OS into an existing project.\n\n**Phases 2-6 (Repeated for each feature):**\nThe next 5 phases happen on a repeated basis for each new feature (or initiative) you build in your product. You can use all of them or pick and choose based on your needs.\n\n- **shape-spec**: The shape-spec command helps you take a rough idea and shape it into well-scoped requirements.\n- **write-spec**: The write-spec command transforms your requirements into a detailed specification document.\n- **create-tasks**: The create-tasks command breaks down your spec into an actionable task list, grouped, prioritized, and ready for implementation.\n- **implement-tasks**: The implement-tasks command provides simple, straightforward implementation with your main agent. Perfect for smaller features or when you want direct control.\n- **orchestrate-tasks**: The orchestrate-tasks command provides advanced orchestration for complex features.\n\nThe system can be found at buildermethods.com/agent-os and on GitHub."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01EVpjxaQ46NgHWSNRkPDQL1)
{
  "url": "https://buildermethods.com/agent-os/workflow",
  "prompt": "Extract the complete workflow phases, what documents/artifacts are created at each stage, which phases are required vs optional, and what the output of each phase is. Focus on the structure and process, not examples."
}
```


## USER

[
  {
    "tool_use_id": "toolu_01EVpjxaQ46NgHWSNRkPDQL1",
    "type": "tool_result",
    "content": "# Agent OS Spec-Driven Development Workflow\n\n## Overview\nAgent OS structures development into six phases: one foundational phase and five repeatable feature development cycles.\n\n## Phase Structure\n\n### Phase 0: Plan Product (Run Once)\n**Trigger:** `plan-product` command at project inception or during Agent OS installation\n\n**Purpose:** Establish foundational strategy including \"product mission, feature roadmap, and technology stack\"\n\n**Output:** Strategic documentation used as reference context for subsequent agent work\n\n**Required:** Yes (prerequisite for feature cycles)\n\n---\n\n## Feature Development Cycle (Phases 1-5, Repeatable)\n\n### Phase 1: Shape Spec (Optional)\n**Trigger:** `shape-spec` command\n\n**Purpose:** Transform rough ideas into \"well-scoped requirements\"\n\n**Output:** Clarified requirements document\n\n**Required:** No—skip if requirements are already defined\n\n---\n\n### Phase 2: Write Spec (Optional/Conditional)\n**Trigger:** `write-spec` command\n\n**Purpose:** Transform requirements into \"detailed specification document\"\n\n**Output:** Complete specification\n\n**Required:** Conditional—needed unless requirements already exist\n\n---\n\n### Phase 3: Create Tasks (Standard)\n**Trigger:** `create-tasks` command\n\n**Purpose:** Decompose specification into \"actionable task list, grouped, prioritized, and ready for implementation\"\n\n**Output:** Structured task breakdown\n\n**Required:** Yes (prerequisite for implementation)\n\n---\n\n### Phase 4A: Implement Tasks (Conditional)\n**Trigger:** `implement-tasks` command\n\n**Purpose:** Direct implementation with main agent\n\n**Use Case:** Smaller features requiring straightforward execution\n\n**Output:** Feature implementation\n\n**Required:** Choose this OR Phase 4B, not both\n\n---\n\n### Phase 4B: Orchestrate Tasks (Conditional)\n**Trigger:** `orchestrate-tasks` command\n\n**Purpose:** Advanced orchestration delegating to \"specialized Claude Code subagents\" with fine-grain control\n\n**Use Case:** Complex features needing distributed work\n\n**Output:** Feature implementation via orchestrated agents\n\n**Required:** Choose this OR Phase 4A, not both"
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_016ezAbPu8uLeKf1yC1wFNq9)
{
  "url": "https://github.com/bmad-code-org/BMAD-METHOD",
  "prompt": "Extract the complete BMAD method structure: what are the stages/phases, what agents/roles are involved, what artifacts/documents are created, which are required vs optional, and what makes this different from other spec-driven approaches. Focus on the methodology structure."
}
```


## USER

[
  {
    "tool_use_id": "toolu_016ezAbPu8uLeKf1yC1wFNq9",
    "type": "tool_result",
    "content": "# BMAD Method Structure Overview\n\n## Four-Phase Methodology\n\nThe BMad Method (BMM) organizes development into four sequential phases:\n\n1. **Phase 1: Analysis** (Optional) – Brainstorming, research, product briefs\n2. **Phase 2: Planning** (Required) – Scale-adaptive specification documents\n3. **Phase 3: Solutioning** (Track-dependent) – Architecture and technical strategy\n4. **Phase 4: Implementation** (Iterative) – Story-driven development with contextual guidance\n\n## Scale-Adaptive Planning Tracks\n\nBMM distinguishes itself through **three parallel planning intensities**:\n\n- **Quick Flow Track**: Minimal planning (tech-spec only) for bug fixes and small, well-defined features\n- **BMad Method Track**: Full planning (PRD + Architecture + UX design documents) for products and complex features\n- **Enterprise Method Track**: Extended planning (BMad Method + security, DevOps, testing strategy) for enterprise requirements\n\nThe system automatically adjusts depth based on project scope rather than applying one-size-fits-all documentation.\n\n## 12 Specialized Agents\n\nThe methodology distributes responsibilities across domain-specific roles:\n\n> \"PM • Analyst • Architect • Scrum Master • Developer • Test Architect (TEA) • UX Designer • Technical Writer • Game Designer • Game Developer • Game Architect • BMad Master\"\n\nThe BMad Master functions as orchestrator, coordinating other agents' contributions.\n\n## Key Differentiators\n\n**Human-Centric Reflection**: Unlike template-driven approaches, BMad emphasizes \"strategic questioning that unlocks breakthrough solutions\" rather than mechanical spec generation.\n\n**Update-Safe Customization**: Agent personalities and expertise persist through framework updates via dedicated configuration folders, enabling teams to maintain consistent voice and domain knowledge.\n\n**Document Sharding**: For large projects, Phase 4 workflows load only relevant specification sections, reducing token usage by 90%+ while maintaining seamless workflow integration."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01RjgaAnQQmMYmq7XnoTRRmt)
{
  "url": "https://buildermethods.com/agent-os/3-layer-context",
  "prompt": "Extract the complete 3-layer context system: what documents go in each layer, what information they contain, when they're used, and how they feed into agent prompts. Focus on the structure and purpose of each layer."
}
```


## USER

[
  {
    "tool_use_id": "toolu_01RjgaAnQQmMYmq7XnoTRRmt",
    "type": "tool_result",
    "content": "# Agent OS 3-Layer Context System\n\n## Layer 1: Standards\n**Purpose:** Defines development conventions and best practices\n\n**Contents:**\n- Coding conventions\n- Architectural patterns\n- Development best practices\n- Organized by specialty (backend, frontend, database, testing)\n\n**Location:** Base Agent OS installation within profiles\n\n**Usage:** Applied during feature implementation to ensure codebase consistency. Can be injected explicitly or automatically via Claude Code Skills integration.\n\n**Key Quote:** \"Standards define **how** you build—your coding conventions, architectural patterns, and development best practices.\"\n\n---\n\n## Layer 2: Product\n**Purpose:** Establishes strategic context about what's being built and why\n\n**Documents:**\n- `mission.md` – product vision and target users\n- `roadmap.md` – prioritized feature list\n- `tech-stack.md` – technology choices\n\n**Location:** Project's `agent-os/product/` folder\n\n**Usage:** Informs strategic decisions during planning and implementation. Helps agents understand the bigger picture when making architectural choices.\n\n**Key Quote:** \"Product-level context is critical because it informs strategic decisions during feature planning and implementation.\"\n\n---\n\n## Layer 3: Specs\n**Purpose:** Provides precise implementation details for upcoming features\n\n**Contents:**\n- Requirements and scope\n- Visual references (mockups, wireframes)\n- Technical specifications\n- Task breakdowns organized by specialty\n- Verification criteria\n\n**Workflow Stages:**\n1. **Shape-Spec** – Interactive research and clarification\n2. **Write-Spec** – Formalized specification document\n3. **Create-Tasks** – Strategic task breakdown\n\n**Usage:** Ensures all stakeholders understand requirements before implementation begins.\n\n---\n\n## Integration Pattern\nEach layer feeds into agent prompts at different workflow stages, with Standards providing foundational consistency, Product guiding strategic decisions, and Specs directing implementation work."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01FxRTERnyxsgTXdtAdjdSyK)
{
  "url": "https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/",
  "prompt": "Extract the complete BMAD method phase structure, what artifacts are created in each phase, which agents are involved, what's required vs optional, and how phases flow together. Focus on methodology structure and document outputs."
}
```


## USER

[
  {
    "tool_use_id": "toolu_01FxRTERnyxsgTXdtAdjdSyK",
    "type": "tool_result",
    "content": "# BMAD Method: Complete Phase Structure\n\n## Overview\nThe BMAD Method (\"Breakthrough Method for Agile AI-Driven Development\") structures AI-driven software development into two sequential phases with specialized agent personas, each producing specific artifacts that feed into the next phase.\n\n## Phase 1: Agentic Planning\n\n**Purpose:** Create comprehensive project specifications before development begins.\n\n### Agents & Artifacts:\n\n| Agent | Role | Output |\n|-------|------|--------|\n| **Analyst** | Market research, competitive analysis, ideation | Project Brief, competitive research documents |\n| **Product Manager** | Requirements gathering, feature specification | PRD.md (comprehensive Product Requirements Document with integrated epics, user stories, FRs, NFRs) |\n| **Architect** | System design, technology selection | Architecture documents (tech stack, system components, API specs, data flows) |\n| **Product Owner** | Epic preparation, document organization | Sharded Epic Files (focused individual epic documents extracted from PRD) |\n\n### Critical Step: Epic Sharding\nThe Product Owner breaks the comprehensive PRD into focused epic files, preserving full architectural context while creating manageable development units. This eliminates overwhelming context and maintains traceability.\n\n**Output format:** Individual epic files like `epic-1-user-auth.md`\n\n## Phase 2: Context-Engineered Development\n\n**Purpose:** Implement code using hyper-detailed context from planning phase.\n\n### Agents & Artifacts:\n\n| Agent | Role | Output |\n|-------|------|--------|\n| **Scrum Master** | Story creation from sharded epics | Story Files (`{epicNum}.{storyNum}.story.md`) with full architectural context, implementation guidance, acceptance criteria |\n| **Developer** | Code implementation, unit testing | Source code files, unit/integration tests, documentation, code review materials |\n| **QA Engineer** | Quality assurance, validation | Risk assessments, test strategies, requirements traceability matrices, quality gate reports |\n\n## Artifact Flow Chain\n\n```\nProject Brief\n    ↓\nPRD.md (with integrated epics)\n    ↓\nArchitecture.md\n    ↓\nSharded Epic Files (epic-1.md, epic-2.md, etc.)\n    ↓\nStory Files (1.1.story.md, 1.2.story.md, etc.)\n    ↓\nDeveloper Code + Tests\n    ↓\nQA Reports & Sign-offs\n```\n\n## Required vs. Optional Elements\n\n**Required for all projects:**\n- PRD creation with integrated epics\n- Architecture documentation\n- Epic sharding process\n- Story file generation\n- Developer implementation\n- QA validation\n\n**Optional/Context-Dependent:**\n- Market research depth (Analyst phase)\n- Expansion packs for specific industries\n- Custom command configurations\n\n## Key Methodology Principles\n\n1. **Spec-Driven:** All development flows from documented specifications\n2. **Context Preservation:** Each subsequent phase includes complete context from previous phases\n3. **Agent Specialization:** Distinct roles prevent scope creep and maintain focus\n4. **Human-in-the-Loop:** Users review and provide feedback at phase boundaries\n5. **Traceability:** Direct mapping from original requirements through final code\n\nThe methodology transforms what's described as \"vibe coding\" (unstructured prompts) into systematic, scalable development suitable for production applications."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_011XMCGVexYvQK6k7YPw5hJz)
{
  "url": "https://medium.com/@visrow/what-is-bmad-method-a-simple-guide-to-the-future-of-ai-driven-development-412274f91419",
  "prompt": "Extract what's in each BMAD document artifact (PRD, Architecture, Epic, Story files), what sections each contains, and which documents are essential vs optional for different project sizes. Focus on document structure and content requirements."
}
```


## USER

[
  {
    "type": "tool_result",
    "content": "Request failed with status code 403",
    "is_error": true,
    "tool_use_id": "toolu_011XMCGVexYvQK6k7YPw5hJz"
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_015Act21FT14XGE3vR6eVFWb)
{
  "url": "https://medium.com/@tim_wang/spec-kit-bmad-and-agent-os-e8536f6bf8a4",
  "prompt": "Compare BMAD, Agent OS, and Spec Kit approaches. Extract what documents each system uses, which phases are required vs optional, and what the key differences are in their methodologies."
}
```


## USER

[
  {
    "type": "tool_result",
    "content": "Request failed with status code 403",
    "is_error": true,
    "tool_use_id": "toolu_015Act21FT14XGE3vR6eVFWb"
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01YKJveETpzJaXR2r87RJBhJ)
{
  "query": "BMAD method PRD.md structure what sections epic sharding story files"
}
```


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01PvGroCdhZANU1enXj7s4Wu)
{
  "query": "\"BMAD method\" artifacts documents PRD architecture epic story format"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01PvGroCdhZANU1enXj7s4Wu",
    "type": "tool_result",
    "content": "Web search results for query: \"\"BMAD method\" artifacts documents PRD architecture epic story format\"\n\nLinks: [{\"title\":\"The BMAD Method: A Framework for Spec Oriented AI-Driven Development - GMOインターネットグループ グループ研究開発本部\",\"url\":\"https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/\"},{\"title\":\"BMad Method in Action: Your Complete Implementation Guide (Part 2)\",\"url\":\"https://buildmode.dev/blog/mastering-bmad-method-2025/\"},{\"title\":\"A Look into the BMAD Method.\",\"url\":\"https://solodev.app/a-look-into-the-bmad-method\"},{\"title\":\"Feedback: BMad needs feature-driven approach and agent coordination (real usage on brownfield project) · Issue #446 · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/issues/446\"},{\"title\":\"Mastering the BMAD Method: A Revolutionary Approach to Agile AI-Driven Development for Modern Software Teams | by Courtlin Holt-Nguyen | Oct, 2025 | Medium\",\"url\":\"https://medium.com/@courtlinholt/mastering-the-bmad-method-a-revolutionary-approach-to-agile-ai-driven-development-for-modern-e7be588b8d94\"},{\"title\":\"bmad-code-org/BMAD-METHOD v6.0.0-alpha.4 on GitHub\",\"url\":\"https://newreleases.io/project/github/bmad-code-org/BMAD-METHOD/release/v6.0.0-alpha.4\"},{\"title\":\"BMAD-METHOD/docs/core-architecture.md at main · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/core-architecture.md\"},{\"title\":\"BMAD-METHOD-v5/docs/user-guide.md at main · bmadcode/BMAD-METHOD-v5\",\"url\":\"https://github.com/bmadcode/BMAD-METHOD-v5/blob/main/docs/user-guide.md\"},{\"title\":\"Planning Phase | bmadcode/BMAD-METHOD | DeepWiki\",\"url\":\"https://deepwiki.com/bmadcode/BMAD-METHOD/4.1-planning-phase\"},{\"title\":\"BMAD-METHOD/docs/user-guide.md at main · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/user-guide.md\"}]\n\nBased on the search results, here's what I found about the BMAD method and its artifacts, documents, and formats:\n\n## Overview\n\nBMAD stands for \"Breakthrough Method for Agile AI-Driven Development\" and employs a sophisticated team of specialized AI agents, each with distinct roles, commands, and artifact outputs.\n\n## Key Artifacts and Documents\n\nThe BMAD Method produces several core document types in a structured workflow:\n\n### Planning Phase Documents\n\n1. **Project Brief** - The Analyst agent creates a detailed project brief through market research and concept validation.\n\n2. **PRD (Product Requirements Document)** - The Product Manager generates a comprehensive PRD including integrated epic definitions, functional requirements, and user story hierarchies.(no content)Expected output: A detailed PRD (15-25 pages) with user stories, requirements, acceptance criteria, and epic breakdown.\n\n3. **Architecture Document** - An Architect agent designs the system architecture based on the PRD and optional UX specifications.(no content)Expected output: Complete architecture document (10-20 pages) with diagrams, specifications, and implementation guidelines.\n\n### Development Phase Documents\n\n4. **Sharded Epics** - The PO is responsible for sharding the PRD and Architecture documents for the development cycle.\n\n5. **Story Files** - The Scrum Master creates hyper-detailed stories from the sharded epic files, with full architectural context preserved.\n\n## Document Format and Structure\n\nThe standard file structure includes: PRD → docs/prd.md, Architecture → docs/architecture.md, Sharded Epics → docs/epics/, Sharded Stories → docs/stories/(no content)Templates are contained in markdown format for common documents like PRDs, architecture specifications, and user stories."
  }
]


## USER

[
  {
    "tool_use_id": "toolu_01YKJveETpzJaXR2r87RJBhJ",
    "type": "tool_result",
    "content": "Web search results for query: \"BMAD method PRD.md structure what sections epic sharding story files\"\n\nLinks: [{\"title\":\"BMad Method in Action: Your Complete Implementation Guide (Part 2)\",\"url\":\"https://buildmode.dev/blog/mastering-bmad-method-2025/\"},{\"title\":\"Planning Phase | bmadcode/BMAD-METHOD | DeepWiki\",\"url\":\"https://deepwiki.com/bmadcode/BMAD-METHOD/4.1-planning-phase\"},{\"title\":\"The BMAD Method: A Framework for Spec Oriented AI-Driven Development - GMOインターネットグループ グループ研究開発本部\",\"url\":\"https://recruit.group.gmo/engineer/jisedai/blog/the-bmad-method-a-framework-for-spec-oriented-ai-driven-development/\"},{\"title\":\"Installation and Setup | bmadcode/BMAD-METHOD | DeepWiki\",\"url\":\"https://deepwiki.com/bmadcode/BMAD-METHOD/2-installation-and-setup\"},{\"title\":\"Mastering the BMAD Method: A Revolutionary Approach to Agile AI-Driven Development for Modern Software Teams | by Courtlin Holt-Nguyen | Oct, 2025 | Medium\",\"url\":\"https://medium.com/@courtlinholt/mastering-the-bmad-method-a-revolutionary-approach-to-agile-ai-driven-development-for-modern-e7be588b8d94\"},{\"title\":\"Feedback: BMad needs feature-driven approach and agent coordination (real usage on brownfield project) · Issue #446 · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/issues/446\"},{\"title\":\"BMAD-METHOD-v5/docs/user-guide.md at main · bmadcode/BMAD-METHOD-v5\",\"url\":\"https://github.com/bmadcode/BMAD-METHOD-v5/blob/main/docs/user-guide.md\"},{\"title\":\"BMAD-METHOD/docs/user-guide.md at main · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/user-guide.md\"},{\"title\":\"A Look into the BMAD Method.\",\"url\":\"https://solodev.app/a-look-into-the-bmad-method\"},{\"title\":\"BMAD-METHOD/docs/working-in-the-brownfield.md at main · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/working-in-the-brownfield.md\"}]\n\nBased on the search results, I can provide you with detailed information about the BMAD method's PRD.md structure, sections, epic sharding, and story files:\n\n## PRD.md Structure and Sections\n\nThe PRD (Product Requirement Document) is created by a PM agent and includes Functional Requirements (FRs), Non-Functional Requirements (NFRs), Epics, and Stories. The expected output is a detailed PRD of 15-25 pages with user stories, requirements, acceptance criteria, and epic breakdown.\n\nThe PRD is typically saved at docs/prd.md.\n\n## Epic Sharding Process\n\nThe PO (Product Owner) agent shards the PRD into focused epic files and shards Architecture into component-specific docs. The epic sharding process systematically breaks down the comprehensive PRD created during Agentic Planning into focused, self-contained development units.\n\nDocuments are converted to sharded folder structure in docs/prd/ and docs/architecture/.\n\n### Epic File Structure\n\nEach sharded epic file contains:\n- Context from PRD (functional requirements, non-functional requirements, target audience)\n- Architecture Integration (component specifications, authentication patterns, database schema requirements)  \n- Epic Scope with numbered stories\n\nExample epic files mentioned: epic-1-user-auth.md, epic-2-products.md, epic-3-shopping.md, epic-4-orders.md\n\n## Story Files\n\nThe SM (Scrum Master) agent reviews previous development/QA notes and drafts the next story from the sharded Epic and Architecture documents.\n\nStory files are:\n- Stored in docs/stories/\n- Named using the pattern {epicNum}.{storyNum}.story.md\n- Hyper-detailed story files that contain everything a development agent needs: full architectural context, implementation guidelines, embedded reasoning explaining the rationale behind each requirement and testing criteria for quality assurance validation(no content)The workflow is: PRD + Architecture → feeds into → PO's Sharded Epic Files (focused development units) → Sharded Epics → feeds into → Scrum Master's Story Files (hyper-detailed implementation guides) → Story Files → feeds into → Developer's Code Implementation"
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01QY2k9zj7KBJnpZSYnbKtS3)
{
  "url": "https://deepwiki.com/bmadcode/BMAD-METHOD/4.1-planning-phase",
  "prompt": "Extract complete details about the BMAD Planning Phase: what documents are created, what sections they contain, what agents create them, and which are required vs optional. Focus on document contents and structure."
}
```


## USER

[
  {
    "tool_use_id": "toolu_01QY2k9zj7KBJnpZSYnbKtS3",
    "type": "tool_result",
    "content": "# BMAD Planning Phase Details\n\n## Phase 2: Planning (Required, Scale-Adaptive)\n\nPhase 2 is the only mandatory phase in the four-phase methodology. The specific workflows executed depend on project complexity level and type.\n\n### Documents Created by Level\n\n**Level 0-1 (Greenfield & Brownfield):**\n- **tech-spec.md** - Created by PM agent\n- Minimal documentation approach\n- Skips Phase 3 (Solutioning) entirely\n\n**Level 2-4 (Greenfield & Brownfield):**\n- **PRD.md** (Product Requirements Document) - Created by PM agent\n- **epics.md** - Epic definitions extracted from PRD\n- **Architecture documentation** - Created in Phase 3 (conditional)\n- Requires full planning rigor before implementation\n\n**Game Projects:**\n- **GDD.md** (Game Design Document) - Created by Game Designer agent\n- Replaces software PRD for game-specific projects\n\n**Conditional Documents:**\n- **ux-design.md** - Created by UX Designer agent if project has UI components\n\n### Agent Responsibilities\n\n| Agent | Document | Levels | Purpose |\n|-------|----------|--------|---------|\n| **PM** | tech-spec.md, PRD.md, GDD.md | All | Primary planning authority; creates requirements |\n| **UX Designer** | ux-design.md | Conditional (if_has_ui) | UI/UX specifications alongside planning |\n| **Game Designer** | GDD.md | Games only | Game-specific requirements and design |\n\n### Document Structure Overview\n\n**Tech Spec (Levels 0-1):**\nThe source indicates tech-specs contain implementation-focused specifications for simple projects, enabling direct progression to Phase 4 without architectural planning.\n\n**PRD (Levels 2-4):**\nAccording to the documentation, PRDs include comprehensive product requirements with \"epics and story list,\" providing the foundation for architectural design in Phase 3.\n\n**GDD (Game Projects):**\nGame Design Documents follow similar comprehensive structure to PRDs but emphasize game-specific mechanics, narrative, and design elements.\n\n### Required vs Optional\n\n- **tech-spec**: Required for Levels 0-1\n- **PRD**: Required for Levels 2-4\n- **GDD**: Required for game projects (replaces PRD)\n- **ux-design**: Optional/conditional based on UI requirements\n- **epics.md**: Generated as part of PRD process for Level 2-4\n\nAll Phase 2 outputs feed into subsequent phases (Phase 3 for Level 2-4 projects, Phase 4 for Level 0-1 projects)."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01S1tbcAduaNbZjWBChzatgY)
{
  "url": "https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/user-guide.md",
  "prompt": "Extract the complete workflow stages, what documents are created at each stage, what agents are involved, and which stages can be skipped for different project sizes. Focus on the methodology structure and required vs optional elements."
}
```


## USER

[
  {
    "type": "tool_result",
    "content": "Request failed with status code 404",
    "is_error": true,
    "tool_use_id": "toolu_01S1tbcAduaNbZjWBChzatgY"
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01KSuYrXB6GDXoH9wNsiiNgd)
{
  "query": "BMAD method v4 vs v6 differences workflow phases agents"
}
```


## ASSISTANT

```json
// TOOL: WebSearch (id: toolu_01VecZRYkpt4ZAiTJ1thqt33)
{
  "query": "agent os builder methods which phases optional skippable workflow"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01VecZRYkpt4ZAiTJ1thqt33",
    "type": "tool_result",
    "content": "Web search results for query: \"agent os builder methods which phases optional skippable workflow\"\n\nLinks: [{\"title\":\"Agent OS Workflow for Spec-Driven Development\",\"url\":\"https://buildermethods.com/agent-os/workflow\"},{\"title\":\"Agent OS | The system for spec-driven development with AI coding agents\",\"url\":\"https://buildermethods.com/agent-os\"},{\"title\":\"GitHub - buildermethods/agent-os: Agent OS is a system for better planning and executing software development tasks with your AI agents.\",\"url\":\"https://github.com/buildermethods/agent-os\"},{\"title\":\"agent-os/CHANGELOG.md at main · buildermethods/agent-os\",\"url\":\"https://github.com/buildermethods/agent-os/blob/main/CHANGELOG.md\"},{\"title\":\"Workflows and agents - Docs by LangChain\",\"url\":\"https://docs.langchain.com/oss/python/langgraph/workflows-agents\"},{\"title\":\"agent-os/standards/best-practices.md at main · buildermethods/agent-os\",\"url\":\"https://github.com/buildermethods/agent-os/blob/main/standards/best-practices.md\"},{\"title\":\"Builder Methods · GitHub\",\"url\":\"https://github.com/buildermethods\"},{\"title\":\"agent-os/README.md at main · buildermethods/agent-os\",\"url\":\"https://github.com/buildermethods/agent-os/blob/main/README.md\"},{\"title\":\"Configuration Options in Agent OS\",\"url\":\"https://buildermethods.com/agent-os/modes\"},{\"title\":\"Implementing Tasks with Agent OS\",\"url\":\"https://buildermethods.com/agent-os/implement-tasks\"}]\n\nBased on the search results, I found information about **Agent OS by Builder Methods** and its workflow phases:\n\n## Six-Phase Development Process\n\nAgent OS follows a six-phase development process starting with the plan-product command, which defines the strategic product mission, projected feature development roadmap, and technology stack, typically run only once at the beginning of a new project.\n\n## Optional and Skippable Phases\n\nThe next 5 phases happen on a repeated basis for each new feature, and you can use all of them or pick and choose based on your needs.\n\nThe five repeatable phases are:\n\n1. **shape-spec** - Helps you take a rough idea and shape it into well-scoped requirements; used when you need clarification before officially writing up a feature. If you already have clear requirements, you can skip this phase and add them directly to your spec's requirements.md.\n\n2. **write-spec** - Transforms your requirements into a detailed specification document.\n\n3. **create-tasks** - Breaks down your spec into an actionable task list, grouped, prioritized, and ready for implementation.\n\n4. **implement-tasks** - Provides simple, straightforward implementation with your main agent, perfect for smaller features or when you want direct control.\n\n5. **orchestrate-tasks** - Provides advanced orchestration for complex features.\n\nThe **shape-spec** phase is explicitly mentioned as optional/skippable if you already have clear requirements."
  }
]


## USER

[
  {
    "tool_use_id": "toolu_01KSuYrXB6GDXoH9wNsiiNgd",
    "type": "tool_result",
    "content": "Web search results for query: \"BMAD method v4 vs v6 differences workflow phases agents\"\n\nLinks: [{\"title\":\"GitHub - bmad-code-org/BMAD-METHOD: Breakthrough Method for Agile Ai Driven Development\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD\"},{\"title\":\"Releases · bmad-code-org/BMAD-METHOD\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/releases\"},{\"title\":\"bmad-code-org/BMAD-METHOD v6.0.0-alpha.4 on GitHub\",\"url\":\"https://newreleases.io/project/github/bmad-code-org/BMAD-METHOD/release/v6.0.0-alpha.4\"},{\"title\":\"GitHub - bmad-code-org/BMAD-METHOD at v6-alpha\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/tree/v6-alpha\"},{\"title\":\"GitHub - bmad-code-org/BMAD-METHOD at V4\",\"url\":\"https://github.com/bmad-code-org/BMAD-METHOD/tree/V4\"},{\"title\":\"bmadcode/BMAD-METHOD | DeepWiki\",\"url\":\"https://deepwiki.com/bmadcode/BMAD-METHOD\"},{\"title\":\"BMad Code | AI Agent Framework [BMad Method]\",\"url\":\"https://bmadcodes.com/\"},{\"title\":\"BMad v6 Alpha | Agent-as-Code for Reliable AI Dev\",\"url\":\"https://bmadcodes.com/v6-alpha/\"},{\"title\":\"GitHub - pavan-official/BMAD-METHOD-v6: Breakthrough Method for Agile Ai Driven Development\",\"url\":\"https://github.com/pavan-official/BMAD-METHOD-v6\"},{\"title\":\"Embrace BMAD or live in regret. BMAD Method V6 Alpha: 5 Game-Changing… | by Mike Schlottig | Oct, 2025 | Medium\",\"url\":\"https://medium.com/@mikeschlottig44/embrace-bmad-or-live-in-regret-22aea58f1a67\"}]\n\nBased on the search results, here are the key differences between BMAD method v4 and v6 in terms of workflow phases and agents:\n\n## Architecture Overview\n\nThe BMad Method v6 is a complete overhaul of the v4 method, now a fully scale adaptive rewrite that scales from small enhancements to massive undertakings across multiple services or architectures.\n\n## Workflow Phases\n\n**V4:**\nV4 used a two-phase approach: (1) Agentic Planning where Analyst, PM, and Architect agents create PRDs and Architecture documents, followed by (2) Context-Engineered Development where the Scrum Master transforms plans into development stories.\n\n**V6:**\nV6 implements a four-phase methodology: Analysis → Planning → Solutioning → Implementation. V6 features a scale-adaptive methodology with Levels 0-4, and the primary workflow is workflow-init which determines project type and routes to appropriate phase workflows.\n\n## Agents\n\n**V4 Agents:**\nThe core agents were Analyst, PM, Architect, Scrum Master, Dev, and QA focused on software development workflows.\n\n**V6 Agents:**\nV6's structure includes BMM (BMad Method) with 12 agents and 34 workflows, BMB (BMad Builder) with 1 agent and 7 workflows, and CIS (Creative Intelligence Suite) with 5 agents and 5 workflows.\n\n## Key Architectural Differences\n\nV6 features lean core with modular extensions, BMad Builder meta-programming, Creative Intelligence Suite, update-safe customization system, multi-language support, and unified bmad/ directory. V6-alpha is near-beta quality—stable and vastly improved over v4, but documentation is still being refined."
  }
]


## ASSISTANT


## ASSISTANT

```json
// TOOL: WebFetch (id: toolu_01Lo9kMyuYcJ93ZrPxoNU2bE)
{
  "url": "https://buildmode.dev/blog/mastering-bmad-method-2025/",
  "prompt": "Extract all details about BMAD method workflow: complete list of agents and what they produce, document formats and sections, what's required vs optional for different project sizes, and practical guidance on when to use which parts of the methodology."
}
```


## USER

[
  {
    "tool_use_id": "toolu_01Lo9kMyuYcJ93ZrPxoNU2bE",
    "type": "tool_result",
    "content": "# BMAD Method Workflow Overview\n\n## Core Agents & Deliverables\n\n**Phase 1: Strategic Planning (Web UI)**\n\n1. **Analyst Agent** (`*analyst`)\n   - Produces: 10-15 page comprehensive project brief\n   - Includes: market analysis, user personas, competitive insights, success criteria\n   - Process: asks probing questions about target users, pain points, and competitive landscape\n\n2. **PM Agent** (`*agent pm`)\n   - Produces: 15-25 page detailed PRD\n   - Includes: structured requirements, user stories with acceptance criteria, functional/non-functional specifications, epic breakdown, success metrics\n   - Converts brief into actionable requirements structure\n\n3. **Architect Agent** (`*agent architect`)\n   - Produces: 10-20 page architecture document\n   - Includes: database schema with relationships, API specifications, security architecture, component hierarchy, technology stack recommendations, deployment strategy\n   - Creates \"executable context\" with specific technology choices and implementation guidelines\n\n4. **PO Agent** (`*agent po`)\n   - Produces: validation report identifying gaps and recommendations\n   - Function: \"runs master checklist\" to ensure alignment between PRD and Architecture\n   - Also performs document \"sharding\" (breaking large documents into focused, consumable pieces)\n\n**Phase 2: Development Preparation (IDE)**\n\n5. **SM Agent** (`*agent sm`)\n   - Produces: detailed development stories from epics\n   - Includes: complete architectural context, specific implementation tasks, acceptance criteria, security requirements, testing requirements, edge cases, dependencies\n\n**Phase 3: Implementation**\n\n6. **Dev Agent** (`*agent dev`)\n   - Produces: production-ready code with architectural alignment\n   - Accesses: full context including architectural decisions, security requirements, compliance standards, integration specifications\n   - Function: implements features with consistent patterns\n\n7. **QA Agent** (optional, `*agent qa`)\n   - Produces: code reviews and improvement suggestions\n   - Function: comprehensive review focusing on security and maintainability\n   - Role: senior developer reviewer for validation\n\n## Document Formats & Sections\n\n**Project Brief** (Analyst output)\n- Market analysis\n- User personas\n- Competitive insights\n- Pain point analysis\n- Success criteria\n\n**PRD** (PM output)\n- User stories with acceptance criteria\n- Functional requirements\n- Non-functional requirements\n- Epic breakdown\n- Feature definitions\n- Success metrics\n\n**Architecture Document** (Architect output)\n- System diagrams\n- Database design\n- API specifications\n- Security patterns\n- Technology selections\n- Deployment architecture\n- Implementation guidelines\n\n## Workflow Variations by Project Type\n\n**Greenfield Full-Stack**\nComplete sequence: Analyst → PM → Architect → PO → (Prep phase) → SM → Dev → QA (optional)\nRecommended timeline: 4-8 hours planning, 120+ hours development\n\n**Brownfield Enhancement**\nModified sequence: Analyst (analyzes existing codebase) → Architect (designs enhancement fitting current patterns) → SM (brownfield-specific stories accounting for legacy code) → Dev (minimal disruption, follows existing patterns)\n\n**Service-Only (Backend API)**\nAbbreviated planning phase with focus on API specifications and database design\n\n**UI-Focused (Frontend)**\nEmphasis on component hierarchy and user experience strategy within architecture phase\n\n## Required vs. Optional by Project Scale\n\n**All Project Sizes (Required)**\n- Analyst phase for context building\n- PM phase for requirements definition\n- Architect phase for technical specifications\n- PO validation checkpoint\n\n**Optional Enhancements**\n- QA agent review (recommended for mission-critical systems)\n- Market research within Analyst phase (depends on novelty)\n- Specialized domain expertise loading\n\n## Practical Implementation Guidance\n\n**When to Skip Planning**: Never—the framework emphasizes that \"always do Analyst → PM → Architect → PO before development\"\n\n**When to Customize Templates**: After completing 3 projects with standard templates; premature customization breaks carefully designed workflows\n\n**When to Use Web UI vs. IDE**: Web UI for Phase 1 (planning with large context models); switch to IDE for Phase 2-3 (development with focused context)\n\n**Context Loading Strategies**\n- Single architecture documents for straightforward features\n- \"Context stacking\" for complex features touching multiple system areas\n- Cross-project \"lessons learned\" knowledge base for pattern reuse\n\n**Cost-Benefit Timing**\n- Planning investment: 8 hours for typical medium-complexity projects\n- Development acceleration: 2-3x faster than traditional approaches\n- Estimated savings: 57% on total project cost versus conventional methods\n\n**Document Sharding Process**: PO agent breaks large planning documents into focused epic files and component-specific documentation accessible during development, reducing context loss and confusion during implementation phases."
  }
]


## ASSISTANT


## ASSISTANT

**BMAD Method & Agent OS - Deep Dive Analysis**

## Two Related But Distinct Systems

**Agent OS (Builder Methods / Brian Casel):**
- Simpler, focused on spec-driven coding workflow
- 6 phases (1 setup + 5 feature cycle)
- Minimal agent specialization
- Markdown-based, tool-agnostic

**BMAD Method (BMad Code):**
- Comprehensive, multi-agent orchestration
- 4 phases with scale-adaptive tracks
- 12+ specialized agents with distinct personalities
- Heavy emphasis on planning rigor before coding

---

## BMAD METHOD - Complete Structure

### Four-Phase Methodology

**Phase 1: Analysis** (Optional)
- **Agent:** Analyst
- **Artifact:** Project Brief (10-15 pages)
- **Contains:** Market analysis, user personas, competitive insights, pain points, success criteria
- **Skippable:** Yes, if market/user context already understood
- **Process:** Interactive questioning about users, problems, competitive landscape

**Phase 2: Planning** (Required - ONLY mandatory phase)
- **Scale-Adaptive:** Workflow changes based on complexity level (0-4)

**Level 0-1 (Simple projects):**
- **Agent:** PM
- **Artifact:** tech-spec.md
- **Contains:** Implementation-focused specifications
- **Skip:** Phase 3 entirely, go straight to Phase 4
- **Use case:** Bug fixes, small features, well-defined enhancements

**Level 2-4 (Complex projects):**
- **Agent:** PM
- **Artifact:** PRD.md (15-25 pages)
- **Contains:** Structured requirements, user stories with acceptance criteria, functional/non-functional requirements, epic breakdown, success metrics
- **Plus:** epics.md extracted from PRD
- **Follow-up:** Must proceed to Phase 3

**Game Projects:**
- **Agent:** Game Designer
- **Artifact:** GDD.md (Game Design Document)
- **Replaces:** PRD for game-specific requirements
- **Contains:** Mechanics, narrative, design elements

**UI Conditional:**
- **Agent:** UX Designer
- **Artifact:** ux-design.md
- **Skippable:** Yes, if no UI component
- **Contains:** UI/UX specifications

**Phase 3: Solutioning** (Conditional on Level 2-4)
- **Agent:** Architect
- **Artifact:** Architecture.md (10-20 pages)
- **Contains:** Database schema with relationships, API specs, security architecture, component hierarchy, tech stack recommendations, deployment strategy, implementation guidelines
- **Validation:** PO agent runs master checklist
- **Skippable:** Only for Level 0-1 projects

**PO Validation (Between Phase 3 & 4):**
- **Agent:** Product Owner
- **Artifact:** Validation report, sharded documents
- **Process:** Checks PRD ↔ Architecture alignment, shards large docs into epic files
- **Output:** docs/epics/epic-1.md, epic-2.md, etc. (focused units)
- **Purpose:** Prevent context overwhelm, maintain traceability
- **Skippable:** No (required when Architecture exists)

**Phase 4: Implementation** (Iterative)
- **Agent:** Scrum Master → Developer → QA (optional)
- **Artifacts:** Story files → Code → Review reports

**SM Process:**
- **Input:** Sharded epic files + architecture
- **Output:** Story files (1.1.story.md, 1.2.story.md, etc.)
- **Contains:** Full architectural context, implementation guidelines, acceptance criteria, security requirements, testing requirements, edge cases, dependencies
- **Purpose:** Hyper-detailed implementation guides

**Developer:**
- **Input:** Story file
- **Output:** Code, tests, documentation
- **Context:** Has full architectural decisions, security patterns, compliance standards

**QA (optional):**
- **Input:** Code + story
- **Output:** Code review, risk assessment, quality validation
- **Skippable:** Yes, but recommended for mission-critical systems

---

## Key Artifact Chain

```
Project Brief (Analysis)
    ↓
PRD.md (Planning - integrated with epics)
    ↓
Architecture.md (Solutioning)
    ↓
PO Validation + Sharding
    ↓
Epic Files (docs/epics/epic-N.md)
    ↓
Story Files (docs/stories/N.M.story.md)
    ↓
Code Implementation
    ↓
QA Reports (optional)
```

---

## What Can Be Skipped

**Always Skip:**
- Phase 1 (Analysis) if you already understand market/users

**Skip for Simple Projects (Level 0-1):**
- Phase 3 (Architecture)
- Epic sharding
- Story file generation
- Go: tech-spec → implement directly

**Skip Conditionally:**
- UX Design (if no UI)
- QA Agent (if not mission-critical)
- shape-spec in Agent OS (if requirements clear)

**Never Skip:**
- Phase 2 (Planning) - at minimum tech-spec for Level 0-1, PRD for Level 2-4
- PO validation (if Architecture exists)
- Task breakdown (some form required for agents)

---

## AGENT OS - Simplified Approach

### 6 Phases

**Phase 0: plan-product** (One-time setup)
- **Artifact:** mission.md, roadmap.md, tech-stack.md
- **Required:** Yes (establishes product context)
- **Skippable:** No

**Phase 1: shape-spec** (Optional discovery)
- **Artifact:** Clarified requirements
- **Required:** No
- **Skip if:** Requirements already clear
- **Use when:** Idea is rough, need interactive brainstorming

**Phase 2: write-spec** (Conditional)
- **Artifact:** Detailed specification document
- **Required:** Conditional
- **Skip if:** Already have spec or requirements doc
- **Use when:** Need formalized specification

**Phase 3: create-tasks** (Required)
- **Artifact:** Task breakdown (grouped, prioritized)
- **Required:** Yes (prerequisite for implementation)
- **Contains:** Actionable chunks ready for agents

**Phase 4A: implement-tasks** (Simple path)
- **Artifact:** Code implementation
- **Required:** Choose this OR 4B
- **Use when:** Straightforward features, single agent sufficient

**Phase 4B: orchestrate-tasks** (Complex path)
- **Artifact:** Coordinated implementation via subagents
- **Required:** Choose this OR 4A
- **Use when:** Complex features, need specialized subagents
- **Subagents:** context-fetcher, file-creator, test-runner, git-workflow, date-checker

---

## Core Philosophical Differences

**BMAD Method:**
- Heavy upfront planning
- Multi-agent coordination orchestrated by BMad Master
- Domain expertise loading (agents have personalities)
- Comprehensive validation checkpoints
- "Never skip planning" philosophy
- Document sharding for context management
- Supports massive projects (multiple services/architectures)

**Agent OS:**
- Lightweight, opt-in planning
- Single agent with subagent helpers
- Three-layer context (Standards, Product, Specs)
- Pick what you need philosophy
- Minimal friction entry
- Focused on feature development cycles

---

## What BMAD Considers Essential

**Required for reliability:**
1. Requirements definition (PM agent, PRD or tech-spec)
2. Architecture clarity (Architect, for Level 2-4)
3. Validation checkpoint (PO ensures alignment)
4. Epic sharding (breaks context into manageable units)
5. Story-driven dev (SM creates detailed implementation guides)

**Their key insight:** Context quality determines success more than sophisticated coordination. Heavy planning investment (8 hours) pays off with 2-3x development speed and 57% cost reduction.

**Recommended minimum:**
- Analyst → PM → Architect → PO validation → Sharded epics → Implementation
- Never bypass planning to jump to code

**Scaling down:**
- Small projects (Level 0-1): PM tech-spec → implement (skip Architecture)
- Medium (Level 2): PM PRD → Architect → implement
- Large (Level 3-4): Full sequence with epic/story breakdown

---

## What They Consider Optional/Skippable

**Can skip:**
- Analyst (if market context known)
- UX Designer (if no UI)
- QA Agent (if not mission-critical)
- Epic sharding (for very small projects)
- Story files (if tech-spec sufficient)

**Can customize:**
- Agent personalities (after 3 projects)
- Domain-specific expansion packs
- Validation rigor levels

**Can't skip without consequences:**
- Requirements documentation (some form mandatory)
- Architecture for complex projects (Level 2+)
- Task breakdown (agents need discrete chunks)

---

## Key Takeaways for Your Context

**BMAD's core value proposition:**
- **Document sharding** solves context overload (90% token reduction)
- **Agent specialization** prevents scope drift
- **Scale-adaptive** tracks prevent over/under-planning
- **Epic → Story hierarchy** maintains full context in digestible chunks

**Agent OS's core value proposition:**
- **Three-layer context** (Standards/Product/Specs) organizes knowledge
- **Optional phases** reduce friction for simple features
- **Task-centric** rather than story-centric
- **Tool-agnostic** works with any AI coding assistant

**Both emphasize:**
- Specs before code
- Context quality over process sophistication
- Discrete, reviewable chunks
- Living documents that evolve

**Both support skipping:**
- Early brainstorming if requirements clear
- Architectural rigor for simple features
- QA validation for low-risk changes

