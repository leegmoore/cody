# The Art of Agent Prompting: Anthropic's Playbook for Reliable AI Agents

**Source:** https://techwithibrahim.medium.com/the-art-of-agent-prompting-lessons-from-anthropics-ai-team-e8c9ac4db3f3
**Author:** Ali Ibrahim
**Published:** 4 days ago (from 2025-01-23)
**Scraped:** 2025-01-23

**Original article:** [Agentailor blog](https://blog.agentailor.com/posts/the-art-of-agent-prompting?utm_source=medium&utm_medium=blog_intro&utm_campaign=prompting_for_agents)

---

## Introduction

Building AI agents is different from traditional prompt engineering. The techniques (chain-of-thought templates, few-shot examples) that work for single-turn responses often backfire when agents need to work autonomously in a loop.

At a recent developer event, [Anthropic's Applied AI team](https://www.anthropic.com/engineering) shared hard-won lessons from building agents like [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) and their advanced research feature. Their approach? Less rigid examples, more conceptual engineering: giving agents the heuristics and principles they need to make good decisions independently.

This guide distills those insights into practical principles using a running example: Cameron AI, a personal finance assistant. You'll learn exactly how to prompt agents that work reliably in production.

## Prompt Engineering: More Than Just Writing Good Instructions

According to Anthropic, prompt engineering is about refining how we communicate with language models — testing, analyzing, and improving prompts until the AI behaves as intended. Think of it as **conceptual engineering:** designing the model's behavior through natural language rather than code.

It involves skills like:

- Writing unambiguous prompts
- Testing systematically and analyzing failures
- Understanding model behavior and limitations
- Making prompts robust across diverse inputs and edge cases, etc.

### Prompt Structure

In general Anthropic emphasizes a structured approach to prompting that includes the following components:

1. Role: 1–2 sentences to establish role and high level description
2. Dynamic retrieve content
3. Detailed instructions
4. Example / few-shot (optional)
5. Repeat critical instructions — particularly useful for very long prompt

But for agents this may vary significantly based on the use case and tools available. We'll explore this further in the next sections.

## The Six Principles That Changed How We Build Agents

### Start simple

The first advice, is to begin with a straightforward prompt that clearly defines the task. Avoid unnecessary complexity in the initial request, perfect prompts are usually written through multiple iterations.

For our financial assistant example, a starting point may look like this:

```
<!-- Role -->

You are Cameron AI, a personal finance assistant.
Your task is to help users manage their budgets, track expenses, and provide financial advice.

<!-- Dynamic content retrieval -->

You will be provided with user data including income, expenses, profile, and financial goals.
<profile>
{{USER_PROFILE}}
</profile>
<financial_goals>
{{USER_FINANCIAL_GOALS}}
</financial_goals>

<!-- Instructions -->

When answering user questions about budgeting or expenses, follow these steps:

1. Analyze the user's financial data provided.
2. Provide clear and actionable advice based on the user's financial situation.
3. If the user asks for specific calculations, ensure accuracy and clarity in your responses.
4. Always consider the user's financial goals when giving advice.
5. If you encounter a question outside your expertise, politely inform the user and suggest consulting a financial advisor.

Present your advice in a friendly and professional manner.

<!-- Repeat critical instructions -->

Remember to always consider the user's financial goals when giving advice.
```

While this prompt is simple, it sets a clear role and provides structured instructions for Cameron AI to follow.

At its current state, this prompt is well suited for basic interactions. In order to make it the main agent system prompt, we need to build on this foundation.

**Takeaway:** Writing the initial prompt may not always be straightforward. Anthropic suggests using AI itself to help draft the first version. They used their [Console](https://console.anthropic.com/) extensively to iterate. All major AI providers offer similar playgrounds to test and refine prompts, use them whenever needed.

### Give them reasonable heuristics

Think of heuristics like what people use to make decisions or solve problems quickly and efficiently. Based on the domain, for humans these rules may be obvious, but for agents, these heuristics need to be explicitly defined in the prompt.

**Examples from Anthropic's experience:**

- **Irreversibility:** "Don't take actions that are irreversible without confirmation"
- **Search budgets:** "For simple questions, use no more than 2 searches. For complex questions, you can use up to 10 searches but no more."

These heuristics are general principles or best practices specific to your agent's domain. They prevent common failure modes while giving the agent flexibility to adapt.

### Tool Selection is key

Agents are powerful because they can use tools. But with many tools available, agents need explicit guidance on which tools to use when.

**Common pitfall:** Multiple tools with the same name or overlapping functionality. This often happens with [MCP](https://blog.agentailor.com/posts/publishing-mcp-server-to-official-registry?utm_source=medium&utm_medium=blog_post&utm_campaign=prompting_for_agents) servers — a `search` tool from Slack MCP Server and another from Notion MCP Server will confuse the agent. Using simple server name as prefix can help disambiguate: `slack_search` and `notion_search`.

**Some of the best practices for tool selection:**

1. **Give explicit guidance on when to use which tools** — Don't assume the agent knows which tool is best for a given context.
2. **Avoid tool name collisions** — Ensure each tool has a unique, descriptive name.
3. **Provide context-specific instructions** — Tell the agent which tools are appropriate for different types of queries. For Cameron AI: "Use **get_expenses_by_date_range** for spending analysis questions. Use **get_budget_status** for questions about budget progress."

**Takeaway:** Models are becoming powerful and can support multiple tools, but without explicit guidance, even the most powerful model will struggle with tool selection.

### Guide thinking process

Multiple models providers provide reasoning models that can think through complex problems and can improve agent performance out of the box. But even with these advancements, we can achieve even better results by explicitly guiding how agents use their thinking capabilities.

For Cameron AI, we can guide the thinking process by adding instructions like:

```
<!-- Instructions for thinking process -->

Before responding to user queries:

1. Use your thinking process to plan your approach:

   - Assess the complexity of the financial question
   - Determine which tools and data you'll need
   - Estimate how many tool calls will be necessary
   - Define what success looks like for this query

2. After retrieving data from tools, use interleaved thinking to:
   - Reflect on the quality and completeness of the data
   - Verify if the information is sufficient or if more data is needed
   - Consider if additional verification is required
   - Evaluate if you should add disclaimers about data accuracy
```

Most of the Anthropic's models support natively the interleaved thinking — the ability to think between tool calls. This is particularly useful for agents that need to evaluate the results they receive and decide on next steps.

For those using models without built-in interleaved thinking, you can simulate this by explicitly instructing or providing a tool that will let the agent pause and reflect.

For example, when Cameron AI retrieves expense data, it should pause to reflect: **_"Is this data complete? Do I need to query a different date range? Should I inform the user about any data gaps?"_**

Key principles for guiding thinking:

- **Plan upfront:** Have the agent think through its approach before making tool calls
- **Reflect on results:** Use interleaved thinking to evaluate tool outputs
- **Verify quality:** Prompt agents to assess whether information meets quality standards
- **Decide when to stop:** Help agents recognize when they have enough information

### Be prepared for side effects

Agents are inherently more unpredictable than [traditional workflows](https://blog.agentailor.com/posts/agents-vs-workflows?utm_source=medium&utm_medium=blog_post&utm_campaign=prompting_for_agents). Because agents operate autonomously in a loop, making decisions based on tool outputs, most prompt changes will have unintended side effects.

Here's a real example from Anthropic's experience building their research agent:

**They initially prompted the agent:** _"Keep searching until you find the highest quality possible source. Always keep searching until you find that source."_

**The unintended side effect?** The agent would keep searching indefinitely until it hit the context window limit, even when a perfect source didn't exist for the query. The solution was to add nuance:

_"If you don't find the perfect source, that's okay. You can stop after a few tool calls."_

For Cameron AI, we might encounter similar issues. For example, if we tell the agent:

```
Always verify all expense entries are categorized correctly before providing advice.
```

This could cause the agent to endlessly verify expenses, even for simple queries like "What's my total spending this month?"

**Best practices for managing side effects:**

1. **Start simple** and add constraints incrementally as you discover edge cases
2. **Test thoroughly** with various scenarios, especially edge cases
3. **Set reasonable boundaries** — give agents permission to be "good enough" rather than perfect
4. **Monitor behavior** in production to catch unexpected loops or excessive tool usage
5. **Iterate based on real-world usage** — users will find edge cases you didn't anticipate

**Takeaway:** prompts that work well for single-turn interactions may cause problems when agents loop autonomously. Always consider "What happens if the agent can't achieve this goal perfectly?"

### Why Your Few-Shot Examples Are Holding You Back

If you're familiar with traditional prompt engineering, you might expect to provide few-shot examples showing the exact step-by-step process the agent should follow. However, according to Anthropic's findings, **this approach is becoming less effective for frontier models and agents.** They have CoT reasoning trained into them, they also know how to think through problems systematically.

### What works better for agents

Instead of prescriptive few-shot examples, focus on:

1. **Guide how to use thinking, not what to think** — Rather than showing exact reasoning chains, tell the agent _how_ to use its thinking process:

```
Use your thinking process to plan out your approach before taking action.
After getting tool results, reflect on whether the information is sufficient.
```

2. **Provide principles over patterns** — Give general guidelines rather than specific examples:

```
For simple financial queries, typically 2-3 tool calls are sufficient.
For complex budget planning, you may need 5-10 tool calls.
```

3. **Use examples sparingly** — If you do include examples, make them non-prescriptive. Show the _type_ of behavior you want, not the exact steps to follow.

**Takeaway:** Showing agents exact processes on how they should think may limit their ability to leverage their full capabilities.

### The 3-Test Rule: Why You Don't Need 100 Test Cases

Evaluations (evals) are critical for systematically measuring whether your agent is improving. Without evals, you'll quickly find it difficult to know if prompt changes are actually making progress. However, evals are more challenging for agents than for simpler tasks.

### Start small and iterate

According to Anthropic, one of the biggest anti-patterns in building agent evals is thinking you need a massive, fully automated test suite before starting. This is wrong and will delay progress.

**Key principle:** The larger the effect size, the smaller the sample size you need.

This is a basic principle from scientific research: if a change has a big impact (like a medication that cures people immediately), you don't need thousands of test subjects to know it works. Similarly, if your prompt change obviously improves your agent, you don't need hundreds of test cases to see it.

**How to start:**

1. **Begin with 3–5 manual test cases** — Just run them by hand and observe what happens
2. **Keep test cases consistent**— Use the same tests each time you change the prompt
3. **Use realistic tasks**— Don't use arbitrary or synthetic problems. Use real questions your users would ask
4. **Look for obvious improvements** — If the agent is clearly better, you're making progress
5. **Gradually expand** — Add more test cases as you discover edge cases

For Cameron AI, you might start with just these test cases:

- "What's my total spending this month?"
- "Am I on track to meet my savings goal?"
- "Should I adjust my budget based on last month's expenses?"

### Tools Make or Break Your Agent: Design Them Right

Well-designed tools are crucial for agent success. Before building complex prompts, ensure your tools are clear and usable. Think of it this way: if you handed a function to another engineer on your team, would they understand how to use it? Apply the same standard to your agent's tools.

> **_Deep Dive Coming Soon:_** _We're creating a comprehensive guide on tool design patterns, schemas, error handling, and best practices for agent tools._ [_Subscribe to our newsletter_](https://buttondown.com/agentailor?utm_source=medium&utm_medium=blog_post&utm_campaign=prompting_for_agents) _to be notified when it's available!_

## Putting It All Together

Prompting for agents is fundamentally different from traditional prompt engineering. Rather than providing rigid templates and few-shot examples, the Anthropic approach emphasizes giving agents the conceptual framework and heuristics they need to operate effectively.

[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) is an iterative journey. Each prompt adjustment, each tool refinement, and each evaluation cycle brings you closer to production-ready performance.

Remember: agents are models using tools in a loop. Your job as a prompt engineer is to give them the conceptual tools, heuristics, principles, and guidance they need to make good decisions autonomously.

Want to dive deeper into **the world of AI Agents development**? Subscribe to [_Agent Briefings_](https://www.linkedin.com/newsletters/agent-briefings-7391777936955310080/)— a weekly **LinkedIn newsletter** where I share insights on AI agent development, architecture, and deployment strategies.

## Additional Resources

- [Anthropic's Original Video: Prompting for Agents | Code w/ Claude](https://www.youtube.com/watch?v=XSZP9GhhuAc)
- [Anthropic's Prompting best practices](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Anthropic's Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [The Future of AI Building: Workflows, Agents, and Everything In Between](https://blog.agentailor.com/posts/agents-vs-workflows?utm_source=medium&utm_medium=blog_post&utm_campaign=prompting_for_agents)
