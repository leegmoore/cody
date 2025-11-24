# Prompting for Agents: Lessons from Anthropic's Applied AI Team

**Source:** YouTube Video Transcript - "Prompting for Agents | Code w/ Claude"
**Speakers:** Hannah and Jeremy, Anthropic Applied AI Team
**Transcribed:** 2025-01-23

---

## Introduction

Welcome everyone. We're here to discuss prompting for agents, picking up from the prompting 101 session. My name is Hannah, and I'm part of the applied AI team at Anthropic. I'm joined by Jeremy, who's also on our applied AI team and works as a product engineer. We're going to switch gears a little bit, moving on from the basics of prompting, and talk about how we approach prompting for agents—systems like the one we built for playing Pokemon.

Hopefully you were present for prompting 101, or perhaps you have some familiarity with basic prompting concepts. We're not going to cover the really basic console prompting or interacting with Claude through the desktop application today. But let me provide a quick refresher on our fundamental approach.

## Prompt Engineering: Programming in Natural Language

We think about prompt engineering as programming in natural language. You're thinking about what your agent or your model is going to be doing, what kind of tasks it's accomplishing. You're trying to clearly communicate to the agent, give examples where necessary, and provide guidelines.

Now, for console prompting, we do follow a very specific structure. But I want you to remove that rigid structure from your mind when thinking about agents, because it could look very different for an agent. For an agent, you may not be laying out this type of very structured prompt. It's actually going to look a lot different. We're going to allow a lot of different things to come in.

I'm going to talk about what agents are, and then I'll turn it over to Jeremy to discuss how we approach prompting for them.

## What Are Agents?

Hopefully you have a sense in your mind of what an agent is. At Anthropic, we like to keep it simple: **agents are models using tools in a loop.**

We give the agent a task and we allow it to work continuously and use tools as it thinks fit. The agent updates its decisions based on the information it's getting back from its tool calls and continues working independently until it completes the task. That's how we keep it—as simple as that.

The environment is where the agent is working. The tools that the agent has, combined with the system prompt where we tell the agent what it should be doing or what it should be accomplishing—these are the key components. And we typically find the simpler you can keep this, the better. Allow the agent to do its work. Allow the model to be the model and work through the task.

## When Should You Use Agents?

You do not always need to use an agent. In fact, there are many scenarios in which you won't actually want to use an agent. There are other approaches that would be more appropriate.

Agents are really best for **complex and valuable tasks**. It's not something you should deploy in every possible scenario. You will not get the results that you want, and you'll spend a lot more resources than you maybe need to.

Let's talk about a framework for thinking about when you should be using an agent and when you might not want to be using an agent.

### Is the Task Complex?

Is this a task that you, a human, can think through with a step-by-step process to complete? If so, you probably don't need an agent. You want to use an agent where it's not clear to you how you'll go about accomplishing the task. You might know where you want to go, but you don't know exactly how you're going to get there, what tools you might need, and what information you might need to arrive at the end state.

### Is the Task Valuable?

Are you going to get a lot of value out of the agent accomplishing this task? Or is this a low-value task or workflow? In that case, a workflow might also be better. You don't really want to be using the resources of an agent unless this is something that's highly leveraged—maybe revenue generating, something that's really valuable to your user, something that's complex.

### Are the Parts of the Task Doable?

When you think about the task that has to occur, would you be able to give the agent the tools that it needs in order to accomplish this task? If you can't define the tools, or if you can't give the agent access to the information or the tool that it would need, you may want to scope the task down. If you can define and give to the agent the tools that it would want, that's a better use case for an agent.

### What's the Cost of Errors?

The last thing you might want to think about is the cost of errors or how easy it is to discover errors. If it's really difficult to correct an error or detect an error, that is maybe not a place where you want the agent to be working independently. You might want to have a human in the loop in that case. If the error is something that you can recover from, or if it's not too costly to have an error occurring, then you might continue to allow the agent to work independently.

## Real-World Examples

Let me make this more concrete with some real-world examples. I'm not going to go through each single one, but let's pick out a few that will be pretty clear or intuitive for most of us.

### Coding

Obviously, all of you are very familiar with using agents in coding. Coding is a great use case. We can think about something like working from a design document. Although you know where you want to get to—which is raising a PR—you don't know exactly how you're going to get there. It's not clear to you what you'll build first, how you'll iterate on that, what changes you might make along the way depending on what you find.

This is high value. You're all very skilled engineers. If an agent is actually able to go from a design document to a PR, that's a lot of time that you, a highly skilled engineer, are saved. You're able to then spend your time on something else that's higher leverage. So this is a great use case for agents.

### Search

Let me mention the cost of error consideration here. In search, if we make an error in the search process, there are ways that we can correct that. We can use citations, we can use other methods of double-checking the results. So if the agent makes a mistake in the search process, this is something we can recover from and it's probably not too costly.

### Computer Use

This is also a place where we can recover from errors. We might just go back, we might try clicking again. It's not too difficult to allow Claude to just click a few times until it's able to use the tool properly.

### Data Analysis

I think data analysis is another interesting example, kind of analogous to coding. We might know the end result that we want to get to. We know a set of insights that we want to gather out of data or a visualization that we want to produce from data. We don't know exactly what the data might look like. The data could have different formats. It could have errors in it. It could have other granularity issues that we're not sure how to disaggregate. We don't know the exact process that we're going to take in analyzing that data, but we know where we want to get in the end. So this is another example of a great use case for agents.

Hopefully these make sense to you, and now I'm going to turn it over to Jeremy. He has some really rich experience building agents and he's going to share some best practices for actually prompting them well and how to structure a great prompt for an agent.

---

## Jeremy's Introduction and Experience

Thanks Hannah. Hi all. So, prompting for agents—I'll go over a few things we think about here. We've learned these experiences mostly from building agents ourselves.

Some agents that you can try from Anthropic are **Claude Code**, which works in your terminal and agentically browses your files and uses the bash tool to really accomplish tasks in coding. Similarly, we have our new **Advanced Research feature** in claude.ai, and this allows you to do hours of research. For example, you can find hundreds of startups building agents or you can find hundreds of potential prospects for your company. This allows the model to do research across your tools, your Google Drive, web search, and things like that.

In the process of building these products, we've learned several important principles.

## Core Principle: Think Like Your Agents

One of the things that we learned is that **you need to think like your agents**. This is maybe the most important principle.

The idea is that you need to understand and develop a mental model of what your agent is doing and what it's like to be in that environment. The environment for the agent is a set of tools and the responses it gets back from those tools.

In the context of Claude Code, the way you might do this is by actually simulating the process and just imagining: if you were in Claude Code's shoes, given the exact tool descriptions it has and the tool schemas it has, would you be confused or would you be able to do the task that it's doing?

**If a human can't understand what your agent should be doing, then an AI will not be able to either.**

This is really important for thinking about tool design, thinking about prompting—to simulate and go through their environment.

## Give Your Agents Reasonable Heuristics

Another key principle is that you need to give your agents reasonable heuristics.

Hannah mentioned that prompt engineering is conceptual engineering. What does that really mean? It's one of the reasons why prompt engineering is not going away, and why I personally expect prompting to get more important, not less important, as models get smarter.

This is because **prompting is not just about text. It's not just about the words that you give the model. It's about deciding what concepts the model should have and what behaviors it should follow to perform well in a specific environment.**

For example, Claude Code has the concept of **irreversibility**. It should not take irreversible actions that might harm the user or harm their environment. So it will avoid these kinds of harmful actions or anything that might cause irreversible damage to your environment, to your code, or anything like that. That concept of irreversibility is something that you need to instill in the model and be very clear about. Think about the edge cases. How might the model misinterpret this concept? How might it not know what it means?

For example, if you want the model to be very eager and you want it to be very agentic, well, it might go over the top a little bit. It might misinterpret what you're saying and do more than what you expect. And so you have to be very crisp and clear about the concepts you're giving the models.

### Examples of Reasonable Heuristics

Some examples of these reasonable heuristics that we've learned:

**Search Budgets:** While we were building the research feature, we noticed that the model would often do a ton of web searches when it was unnecessary. For example, it would find the actual answer it needed—like maybe it would find a list of scaleups in the United States—and then it would keep going even though it already had the answer. That's because we hadn't told the model explicitly: when you find the answer, you can stop. You no longer need to keep searching.

Similarly, we had to give the model budgets to think about. For example, we told it that **for simple queries it should use under five tool calls, but for more complex queries it might use up to 10 or 15**.

These kinds of heuristics that you might assume the model already understands—you really have to articulate clearly.

A good way to think about this is: if you're managing maybe a new intern who's fresh out of college and has not had a job before, how would you articulate to them how to get around all the problems they might run into in their first job? And how would you be very crisp and clear with them about how to accomplish that? That's often how you should think about giving heuristics to your agents, which are just general principles that it should follow. They may not be strict rules, but they're practices.

## Tool Selection is Key

Another point is that **tool selection is key**.

As models get more powerful and able to handle more and more tools—Sonnet 4 and Opus 4 can handle up to a hundred tools, even more than that if you have great prompting—in order to use these tools you have to be clear about which tools it should use for different tasks.

For example, for research we can give the model access to Google Drive. We can give it access to MCP tools like Sentry or DataDog or GitHub. It can search across all these tools, but the model doesn't know already which tools are important for which tasks, especially in your specific company context.

For example, if your company uses Slack a lot, maybe it should default to searching Slack for company-related information. All these questions about how the model should use tools—you have to give it explicit principles about when to use which tools and in which contexts.

This is really important and it's often something I see where people don't prompt the agent at all about which tool to use. They just give the model some tools with some very short descriptions and then they wonder: why isn't the model using the right tool? Well, it's likely because the model doesn't know what it should be doing in that context.

## Guide the Thinking Process

Another point here is that you can **guide the thinking process**.

People often turn extended thinking on and then let their agents run and assume it will get out-of-the-box better performance. Actually, that assumption is true. Most of the time you will get out-of-the-box better performance, but you can squeeze even more performance out of it if you just prompt the agent to use its thinking well.

For example, for search, what we do is tell the model to **plan out its search process**. In advance, it should decide:
- How complicated is this query?
- How many tool calls should I use here?
- What sources should I look for?
- How will I know when I'm successful?

We tell it to plan out all these exact things in its first thinking block.

And then a new capability that the Claude 4 models have is the ability to use **interleaved thinking between tool calls**. So after getting results from the web, we often find that models assume that all web search results are true. They don't have any—we haven't told them explicitly that this isn't the case. And so they might take these web results and run with them immediately.

So one thing we prompted our models to do is to use this interleaved thinking to really reflect on the quality of the search results and decide:
- Do they need to verify them?
- Do they need to get more information?
- Should they add a disclaimer about how the results might not be accurate?

## Be Prepared for Side Effects

Another point when prompting agents is that **agents are more unpredictable than workflows** or just classification-type prompts. Most changes will have unintended side effects.

This is because agents will operate in a loop autonomously. So for example, if you tell the agent "keep searching until you find the correct answer, you know, find the highest quality possible source and always keep searching until you find that source," what you might run into is the unintended side effect of the agent just not finding any sources. Maybe this perfect source doesn't exist for the query. And so it will just keep searching until it hits its context window.

And that's actually what we ran into as well. And so you have to tell the agent: **if you don't find the perfect source, that's okay. You can stop after a few tool calls.**

So just be aware that your prompts may have unintended side effects and you may have to roll those back.

## Help the Agent Manage Its Context Window

Another point is to **help the agent manage its context window**.

The Claude 4 models have a 200k token context window. This is long enough for a lot of long-running tasks, but when you're using an agent to do work autonomously, you may hit this context window. There are several strategies you can use to extend the effective context window.

### Compaction

One of them that we use for Claude Code is called **compaction**. This is just a tool that the model has that will automatically be called once it hits around 190,000 tokens—near the context window. This will summarize or compress everything in the context window to a really dense but accurate summary that is then passed to a new instance of Claude with the summary, and it continues the process.

We find that this essentially allows you to run infinitely with Claude Code. You almost never run out of context. Occasionally it will miss details from the previous session, but the vast majority of the time this will keep all the important details and the model will remember what happened in the last session.

### External File Writing

Similarly, you can write to an external file. The model can have access to an extra file, and these Claude 4 models are especially good at writing memory to a file. They can use this file to essentially extend their context window.

### Sub-Agents

Another point is that you can use **sub-agents**. We won't talk about this a lot here, but essentially if you have agents that are always hitting their context windows, you may delegate some of what the agent is doing to another agent.

For example, you can have one agent be the lead agent and then sub-agents do the actual searching process. Then the sub-agents can compress the results to the lead agent in a really dense form that doesn't use as many tokens, and the lead agent can give the final report to the user.

We actually use this process in our research system and this allows you to compress what's going on in the search and then only use the context window for the lead agent for actually writing the report. So this kind of multi-agent system can be effective for limiting the context window.

## Let Claude Be Claude

Finally, you can **let Claude be Claude**.

Essentially what this means is that Claude is great at being an agent already. You don't have to do a ton of work at the very beginning. So I would recommend just trying out your system with a bare-bones prompt and bare-bones tools and seeing where it goes wrong and then working from there.

Don't assume that Claude can't do it ahead of time because Claude often will surprise you with how good it is.

## Tool Design Principles

I talked already about tool design, but essentially the key point here is you want to make sure that your tools are good.

### What is a Good Tool?

A good tool will have:
- A **simple, accurate tool name** that reflects what it does
- You'll have **tested it** and made sure that it works well
- It'll have a **well-formed description** so that a human reading this tool—imagine you give a function to another engineer on your team—would they understand this function and be able to use it?

You should ask the same question about the agent computer interfaces or the tools that you are giving your agent. Make sure that they're usable and clear.

### Avoid Tool Confusion

We also often find that people will give an agent a bunch of tools that have very similar names or descriptions. For example, you give it six search tools and each of the search tools searches a slightly different database. **This will confuse the model.**

So try to keep your tools fairly distinct and combine similar tools into just one.

## Example: Agent Tool Use Loop

One quick example here is that you can have an agent use these different tools in a sequence:

1. First, **search the inventory** in a database, run a query
2. Based on the information it finds, it can **reflect on the inventory**, think about it for a little bit
3. Then decide to **generate an invoice**, generate this invoice
4. Think about what it should do next
5. Then decide to **send an email**

This loop involves the agent getting information from the database, which is its external environment, using its tools, and then updating based on that information until it accomplishes the task. And that's how agents work in general.

---

## Live Demo: Research Agent

Let me switch to my computer and walk through a demo. You can see here that this is our Console. The Console is a great tool for simulating your prompts and seeing what they would look like in a UI. I use this while we were iterating on research to understand what's really going on and what the agent's doing. This is a great way to think like your agents and put yourself in their shoes.

You can see we have a big prompt here. It's not super long—it's around a thousand tokens. It involves the researcher going through a research process. We tell it exactly what it should plan ahead of time. We tell it how many tool calls it should typically use. We give it some guidelines about what facts it should think about, what makes a high-quality source, stuff like that. And then we tell it to use parallel tool calls—run multiple web searches in parallel at the same time rather than running them all sequentially.

### The Question

Then we give it this question: **"How many bananas can fit in a Rivian R1S?"**

This is not a question that the model will be able to answer because the Rivian R1S came out very recently. It's a car. It doesn't know in advance all the specifications and everything. So it'll have to search the web.

Let's run it and see what happens.

### Observing the Process

You'll see that at the very beginning, it will think and break down this request. It realizes, okay, web search is going to be helpful here. I should get cargo capacity. I should search.

And you see here it ran two web searches in parallel at the same time. That allowed it to get these results back very quickly. And then it's reflecting on the results. So it's realizing, okay, I found the banana dimensions. I know that the USDA identifies bananas as 7 to 8 inches long. I need to run another web search. Let me convert these to more standard measurements.

You can see it's using tool calls interleaved with thinking, which is something new that the Claude 4 models can do.

Finally, it's running some calculations about how many bananas could be packed into the cargo space of the truck. And it's running a few more web searches.

### The Result

You can see here that this is a fairly... [the model completes its calculation]

It estimates approximately **48,000 bananas**. I've seen the model estimate anything between 30,000 to 50,000. I think the right answer is around 30,000. So this is roughly correct.

### Learning from the Demo

Going back to the slides, I think this approach of testing out your prompt, seeing what tools the model calls, reading its thinking blocks, and actually seeing how the model's thinking will often make it really obvious what the issues are and what's going wrong.

So you'll test it out and you'll just see: okay, maybe the model's using too many tools here, maybe it's using the wrong sources, or maybe it's just following the wrong guidelines. This is a really helpful way to think like your agents and make them more concrete.

---

## Evaluations for Agents

Evaluations are really important for any system. They're really important for systematically measuring whether you're making progress in your prompt. Very quickly, you'll notice that it's difficult to really make progress on a prompt if you don't have an eval that tells you meaningfully whether your prompt is getting better and whether your system is getting better.

But **evals are much more difficult for agents**. Agents are long-running. They do a bunch of things. They may not always have a predictable process. Classification is easier to eval because you can just check: did it classify this output correctly? But agents are harder.

### Key Principles for Agent Evaluations

Here are a few tips to make this a bit easier:

#### 1. Larger Effect Size = Smaller Sample Size Needed

The larger the effect size, the smaller the sample size you need. This is a principle from science in general. If an effect size is very large—for example, if a medication will cure people immediately—you don't really need a large sample size of a ton of people to know that the treatment is having an effect.

Similarly, when you change a prompt, if it's really obvious that the system is getting better, you don't need a large eval.

**This is a common anti-pattern:** I often see teams think that they need to set up a huge eval of like hundreds of test cases and make it completely automated when they're just starting out building an agent. This is a failure mode. You should start out with a very small eval and just run it and see what happens. You can even start out manually.

But the important thing is to **just get started**. I often see teams delaying evals because they think that they're so intimidating or that they need such an intense eval to really get some signal. But you can get great signal from a small number of test cases. You just want to keep those test cases consistent and then keep testing them so you know whether the model and the prompt is getting better.

#### 2. Use Realistic Tasks

You also want to use realistic tasks. Don't just come up with arbitrary prompts or descriptions or tasks that don't really have any real correlation to what your system will be doing.

For example, if you're working on coding tasks, you don't want to give the model just competitive programming problems because this is not what real-world coding is like. You'll want to give it realistic tasks that really reflect what your agent will be doing.

Similarly, in finance, you'll want to take tasks that real people are trying to solve and just use them to evaluate whether the model can do those. This allows you to really measure whether the model is getting better at the tasks that you care about.

#### 3. LLM as Judge is Powerful (with a Rubric)

Another point is that **LLM as judge is really powerful, especially when you give it a rubric**.

Agents will have lots of different kinds of outputs. For example, if you're using them for search, they might have tons of different kinds of search reports with different kinds of structure. But LLMs are great at handling lots of different kinds of structure and text with different characteristics.

One thing that we've done, for example, is given the model just a clear rubric and then asked it to evaluate the output of the agent.

For example, for search tasks, we might give it a rubric that says:
- Check that the model looked at the right sources
- Check that it got the correct answer

In this case, we might say: check that the model guessed that the amount of bananas that can fit in a Rivian R1S is between like 10,000 and 50,000. Anything outside that range is not realistic.

You can use things like that to benchmark whether the model is getting the right answers, whether it's following the right process.

#### 4. Nothing Replaces Human Evals

At the end of the day though, **nothing is a perfect replacement for human evals**. You need to test the system manually. You need to see what it's doing. You need to look at the transcripts, look at what the model is doing, and understand your system if you want to make progress on it.

### Examples of Eval Types

Here are some examples of evals:

#### Answer Accuracy

This is where you just use an LLM as judge to judge whether the answer is accurate. For example, in this case you might say: the agent needs to use a tool to query the number of employees and then report the answer—and you know the number of employees at your company. So you can just check that with an LLM as judge.

The reason you use an LLM as judge here is because it's more robust to variations. For example, if you're just checking for the integer 47 in the output, that is not very robust. If the model says "47" as text, you'll grade it incorrectly. So you want to use an LLM as judge there to be robust to those minor variations.

#### Tool Use Accuracy

Another way you can eval agents is tool use accuracy. Agents involve using tools in a loop. And so if you know in advance what tools the model should use or how it should use them, you can just evaluate if it used the correct tools in the process.

For example, in this case, I might evaluate: the agent should use web search at least five times to answer this question. And so I could just check in the transcript programmatically: did the tool call for web search appear five times or not?

Similarly, you might check: in response to the question "book a flight," the agent should use the "search flights" tool. And you can just check that programmatically. This allows you to make sure that the right tools are being used at the right times.

#### Final State Evaluation (ToolBench-style)

Finally, a really good eval for agents is inspired by ToolBench. You can look this up. ToolBench is an open-source benchmark that shows you can evaluate whether agents reach the correct final state.

A lot of agents are modifying a database or interacting with a user in a way where you can say: the model should always get to this state at the end of the process.

For example, if your agent is a customer service agent for airlines and the user asks to change their flight, at the end of the agentic process in response to that prompt, it should have changed the flight in the database. And so you can just check at the end of the agentic process: was the flight changed? Was this row in the database changed to a different date? And that can verify that the agent is working correctly.

This is really robust and you can use it a lot in different use cases. For example, you can check that your database is updated correctly. You can check that certain files were modified, things like that as a way to evaluate the final state that the agent reaches.

---

## Q&A Session

And that's it from us. We're happy to take your questions.

### Question 1: Building Prompts - Long First or Iterative?

**Question:** Can you talk about building prompts for agents? Are you giving it kind of longer prompts first and then iterating, or are you starting kind of chunk by chunk? What's that look like? And can you show a little bit more on that thought process?

**Jeremy:** That's a great question. Let me switch back to my screen. You can see this is a final prompt that we've arrived at, but this is not where we started.

**The answer to your question is that you start with a short, simple prompt.**

Let me demonstrate. I might just say "search the web agentically." I'll change this to a different question: "How good are the Claude 4 models?" And then we'll just run that.

You'll want to start with something very simple and just see how it works. You'll often find that Claude can do the task well out of the box. But if you have more needs and you need it to operate really consistently in production, you'll notice edge cases or small flaws as you test with more use cases. And so you'll add those into the prompt.

**Building an agent prompt, what it looks like concretely:**
1. Start simple
2. Test it out
3. See what happens
4. Iterate from there
5. Start collecting test cases where the model fails or succeeds
6. Over time, try to increase the number of test cases that pass

The way to do this is by adding instructions, adding examples to the prompt. But you really only do that when you find out what the edge cases are.

[The model responds that the Claude 4 models are indeed good.]

### Question 2: Few-Shot Examples for Agents?

**Question:** When I do normal prompting and it's not agentic, I'll often give like a few-shot example of like, "hey, here's like input, here's output." This works really well for classification tasks, stuff like that, right? Is there a parallel here in this agentic world? Are you finding that that's ever helpful or should I not think about it that way?

**Jeremy:** That is a great question. Should you include few-shot examples in your prompt?

Traditional prompting techniques involve giving the model a chain of thought and then giving few-shot examples—a bunch of examples to imitate. We find that **these techniques are not as effective for state-of-the-art frontier models and for agents**.

The main reason for this is that if you give the model a bunch of examples of exactly what process it should follow, that just limits the model too much. These models are smarter than you can predict, and so you don't want to tell them exactly what they need to do.

Similarly, chain of thought has just been trained into the models at this point. The models know to think in advance. They don't need to be told "use chain of thought."

**But what we can do here:**

**One:** You can tell the model **how to use its thinking**. Rather than telling the model "you need to use a chain of thought"—it already knows that—you can just say "use your thinking process to plan out your search" or "to plan out what you're going to do in terms of coding." Or you can tell it to remember specific things in its thinking process, and that helps the agent stay on track.

**As far as examples go:** You'll want to give the model examples, but not too prescriptive.

I think we are out of time, but you can come up to me personally and I'll talk to you all after.

---

## Conclusion

Thank you for coming, and we hope these insights into prompting for agents help you build more effective agentic systems with Claude.

**Key Takeaways:**
1. Think like your agents - simulate their environment
2. Give reasonable heuristics, not rigid rules
3. Tool selection requires explicit guidance
4. Guide the thinking process for better performance
5. Be prepared for unintended side effects
6. Help agents manage their context window
7. Let Claude be Claude - start simple
8. Design clear, distinct tools
9. Start with small, realistic evals
10. Avoid prescriptive few-shot examples for frontier models
