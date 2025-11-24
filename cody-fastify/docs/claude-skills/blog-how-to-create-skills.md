# How to Create Skills: Key Steps, Limitations, and Examples

**Source:** https://www.claude.com/blog/how-to-create-skills-key-steps-limitations-and-examples
**Category:** Coding, Agents
**Product:** Claude apps
**Published:** November 19, 2025
**Reading time:** 5 min
**Scraped:** 2025-01-23

---

Learn how to write tailored skills that deliver stronger, more effective outputs from Claude.

[Skills](https://www.claude.com/blog/skills) are custom instructions that extend Claude's capabilities for specific tasks or domains.

When you create a skill via a [SKILL.md](http://skill.md/) file, you're teaching Claude how to handle specific scenarios more effectively. The power of skills lies in their ability to encode institutional knowledge, standardize outputs, and handle complex multi-step workflows that would otherwise require repeated explanation or investment in building a custom agent.

Learn how to create skills that transform Claude from general-purpose assistant into specialized expert for your specific workflows either with our [skill creator](https://github.com/anthropics/skills/tree/main/skill-creator) template or manually. (Pro-tip: to make it easy, we recommend building your [SKILL.md](http://skill.md/) file with this template and tailoring from there).

## Creating a Skill in 5 Steps

Follow this structured approach to build skills that trigger more reliably.

### 1. Understand the Core Requirements

Before writing anything, clarify what problem your skill solves. Strong skills address concrete needs with measurable outcomes. "Extract financial data from PDFs and format as CSV" beats "Help with my finance stuff" because it specifies the input format, the operation, and the expected output.

Start by asking yourself: What specific task does this skill accomplish? What triggers should activate it? What does success look like? What are the edge cases or limitations?

### 2. Write the Name

Your skill needs three core components: **name** (clear identifier), **description** (when to activate), and **instructions** (how to execute). In fact, the name and description are the only parts of the [SKILL.md](http://skill.md/) file that influence triggering, in other words, the ability for Claude to call a skill for specialized knowledge or workflows.

The name should be straightforward and descriptive. Use lowercase with hyphens (e.g., pdf-editor, brand-guidelines). Keep it short and clear.

### 3. Write the Description Field

The description determines when your skill activates, making it the most critical component. Write it from Claude's perspective, focusing on triggers, capabilities, and use cases.

A strong description balances several elements: specific capabilities, clear triggers, relevant context, and boundaries.

**Weak description**:

```markdown
This skill helps with PDFs and documents.
```

**Strong description**:

```markdown
Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale. Use for document workflows and batch operations. Not for simple PDF viewing or basic conversions.
```

The stronger version gives Claude multiple data points: specific verbs (extract, create, merge), concrete use cases (form filling, batch operations), and clear boundaries (not for simple viewing).

### 4. Write the Main Instructions

Your instructions should be structured, scannable, and actionable. Use markdown headers, bullet points for options, and code blocks for examples.

Structure with clear hierarchy: overview, prerequisites, execution steps, examples, error handling, and limitations. Break complex workflows into discrete phases with clear inputs and outputs.

Include concrete examples showing correct usage. Specify what the skill cannot do to prevent misuse and manage expectations. Your [SKILL.md](http://skill.md/) file can also include additional reference files and assets to provide even more clarity and guidance around what you're asking the agent to do when the skill is triggered.

### 5. Upload Your Skill

Depending on what Claude surface you're building on, here's how to upload your skill for use:

- [Claude.ai](http://claude.ai/) (Claude apps): Go to **Settings** and add your custom skill there. Custom skills require a Pro, Max, Team, or Enterprise plan with code execution enabled. Skills uploaded here are individual to each user—they are not shared organization-wide and cannot be centrally managed by admins.
- [Claude Code](https://www.claude.com/product/claude-code): Create a skills/ directory in your plugin or project root and add skill folders containing SKILL.md files. Claude discovers and uses them automatically when the plugin is installed. Example structure:

```markdown
my-project/
├── skills/
│   └── my-skill/
│       └── SKILL.md
```

- [Claude Developer Platform](https://www.claude.com/platform/api): Upload skills via the Skills API (/v1/skills endpoints). Use a POST request with the required beta headers:

```markdown
curl -X POST "https://api.anthropic.com/v1/skills" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: skills-2025-10-02" \
  -F "display_title=My Skill Name" \
  -F "files[]=@my-skill/SKILL.md;filename=my-skill/SKILL.md"
```

## Testing and Validation

Test your skill with realistic scenarios before deploying it. Systematic testing reveals gaps in instructions, ambiguities in descriptions, and unexpected edge cases that only surface during actual use.

Create a test matrix covering three scenarios:

- **Normal operations**: Test the skill with typical requests it should handle perfectly. If you built a financial analysis skill, try "analyze Microsoft's latest earnings" or "build a datapack for this 10-K filing." These baseline tests confirm your instructions work as intended.
- **Edge cases**: Test with incomplete or unusual inputs. What happens when data is missing? When file formats are unexpected? When users provide ambiguous instructions? Your skill should handle these gracefully—either producing degraded but useful output or explaining what's needed to proceed.
- **Out-of-scope requests**: Test with tasks that seem related but shouldn't trigger your skill. If you built an NDA review skill, try requesting "review this employment agreement" or "analyze this lease." The skill should stay dormant, letting other skills or general Claude capabilities handle the request.

Consider implementing the following tests for even deeper validation:

- **Triggering tests:** Does the skill activate when expected? Test with both explicit requests ("use the financial datapack skill to analyze this company") and natural requests ("help me understand this company's financials"). Does it stay inactive when irrelevant? A well-scoped skill knows when not to activate. Test similar but distinct requests to verify boundaries.
- **Functional tests:** These include output consistency (do multiple runs with similar inputs produce comparable results?), usability (can someone unfamiliar with the domain use it successfully?), and documentation accuracy (do your examples match actual behavior?).

## Iterate Based on Usage

Monitor how your skill performs in real-world usage. Refine descriptions if triggering is inconsistent. Clarify instructions if outputs vary unexpectedly. As with prompts, the best skills evolve through practical application.

## General Best Practices for Creating Skills

These principles help you create skills that are maintainable, reusable, and genuinely useful rather than theoretical.

### Start with Use Cases

Don't write skills speculatively. Build them when you have real, repeated tasks. The best skills solve problems you encounter regularly.

Before creating a skill, ask: Have I done this task at least five times? Will I do it at least ten more times? If yes, a skill makes sense.

### Define Success Criteria—and Include It in the Skill

Tell Claude what a good output looks like. If you're creating financial reports, specify required sections, formatting standards, validation checks, and quality thresholds. Include these criteria in your instructions so Claude can self-check.

### Use the Skill-Creator Skill

The [skill-creator skill](https://github.com/anthropics/skills/tree/main/skill-creator) guides you through creating well-structured skills. It asks clarifying questions, suggests description improvements, and helps format instructions properly. Available in the [Skills repository on GitHub](https://github.com/anthropics/skills) and directly via [Claude.ai](http://claude.ai/), it's particularly valuable for your first few skills.

## Skill Limitations and Considerations

Understanding how skills work—and their boundaries—helps you design more effective skills and set appropriate expectations.

### Skill Triggering

Claude evaluates skill descriptions against your request to determine relevance. This isn't keyword matching—Claude understands semantic relationships. However, vague descriptions reduce triggering accuracy.

Multiple skills can activate simultaneously if they address different aspects of a complex task. Overly generic descriptions cause inappropriate activation, while missing use cases cause missed activations.

### Appropriate File Sizes

When writing skills, avoid bloating the context window with unnecessary content. Consider whether each piece of information needs to be loaded every time, or only conditionally.

Use a "menu" approach: if your skill covers multiple distinct processes or options, the SKILL.md should describe what's available and use relative paths to reference separate files for each. Claude then reads only the file relevant to the user's task, leaving the others untouched for that conversation.

These separate files don't need to represent mutually exclusive paths. The key principle is breaking content into reasonable chunks and letting Claude select what's needed based on the task at hand.

## Real-World Skills Examples

### Skill Example #1: DOCX Creation Skill

[Full skill on GitHub](https://github.com/anthropics/skills/tree/main/document-skills/docx)

**What makes it strong**: Provides a clear decision tree that routes Claude to the right workflow based on task type, uses progressive disclosure to keep the main file lean while referencing detailed implementation files only when needed, and includes concrete good/bad examples that show exactly how to implement complex patterns like tracked changes.

### Skill Example #2: Brand Guidelines

[Full skill on GitHub](https://github.com/anthropics/skills/blob/main/brand-guidelines/SKILL.md?plain=1)

```markdown
name: brand-guidelines
description: Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.
license: Complete terms in LICENSE.txt
---

# Anthropic Brand Styling

## Overview

To access Anthropic's official brand identity and style resources, use this skill.

**Keywords**: branding, corporate identity, visual identity, post-processing, styling, brand colors, typography, Anthropic brand, visual formatting, visual design

## Brand Guidelines

### Colors

**Main Colors:**

- Dark: `#141413` - Primary text and dark backgrounds
- Light: `#faf9f5` - Light backgrounds and text on dark
- Mid Gray: `#b0aea5` - Secondary elements
- Light Gray: `#e8e6dc` - Subtle backgrounds

**Accent Colors:**

- Orange: `#d97757` - Primary accent
- Blue: `#6a9bcc` - Secondary accent
- Green: `#788c5d` - Tertiary accent

### Typography

- **Headings**: Poppins (with Arial fallback)
- **Body Text**: Lora (with Georgia fallback)
- **Note**: Fonts should be pre-installed in your environment for best results
```

**What makes it strong**: Provides precise, actionable information Claude doesn't inherently have (exact hex codes, font names, size thresholds) with a clear description that tells Claude both what it does and when to trigger it.

### Skill Example #3: Frontend Design Skill

[Blog post about this skill](https://www.claude.com/blog/improving-frontend-design-through-skills)

**What makes it strong**: Creative capability with clear boundaries, copyright protection built in, technical scaffolding for non-musicians, quality standards.

## Common Questions

### How do I write descriptions that actually trigger?

Focus on capabilities and scenarios, not generic keywords. Include action verbs, specific file types, and clear use cases. Instead of "document processing skill," write "extract tables from PDFs and convert to CSV format for data analysis workflows."

### How does Claude decide which skills to invoke?

Claude evaluates your request against skill descriptions using semantic understanding. It's not keyword matching—Claude determines contextual relevance. Multiple skills can activate if they address different aspects of your request.

### What's the right granularity for my descriptions?

Aim for single-purpose skills. "SEO optimization for blog posts" is focused enough for specific instructions while broad enough for reusability. Too broad: "Content marketing helper." Too narrow: "Add meta descriptions."

### How do I share Skills across my organization?

Regardless of your team size, we suggest creating a shared document repository with skill specifications.

**For smaller teams**, use a template format with name, description, instructions, and version info.

**For medium to large teams**, establish a skills governance process:

- Designate skill owners for each domain (finance, legal, marketing)
- Maintain a central wiki or shared drive as your skill library
- Include usage examples and common troubleshooting for each skill
- Version your skills and document changes in a changelog
- Schedule quarterly reviews to update or retire outdated skills

**Best practices for all team sizes**:

- Document the business purpose for each skill
- Assign clear ownership for maintenance and updates
- Create onboarding materials showing new team members how to implement shared skills
- Track which skills deliver the most value to prioritize maintenance efforts
- Use consistent naming conventions so skills are easy to find

Enterprise customers can work with Anthropic's customer success team to explore additional deployment options and governance frameworks.

### How do I debug skills?

Test triggering and execution separately. If skills don't activate, broaden your description and add use cases. If results are inconsistent, add specificity to instructions and include validation steps. Create a test case library covering normal usage, edge cases, and out-of-scope requests.

## Get Started

Ready to build with Skills? Here's how to start:

[Claude.ai](https://claude.ai/) users:

- Enable Skills in Settings → Features
- Create your first project at claude.ai/projects
- Try combining project knowledge with Skills for your next analysis task

API developers:

- Explore the Skills endpoint in [documentation](https://docs.anthropic.com/)
- Check out our [skills cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills)

Claude Code users:

- Install Skills via [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- Check out our [skills cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills)

---

**Related Resources:**
- [Agent Skills eBook](https://www.claude.com/blog/skills)
- [Skills Explained](https://claude.com/blog/skills-explained)
