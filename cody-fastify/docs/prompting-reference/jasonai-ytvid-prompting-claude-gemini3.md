# Prompting Claude and Gemini 3: How Anthropic 10x'd Sonnet 4.5 Frontend Design

**Source:** YouTube Video Transcript - Jason AI
**Topic:** Prompting strategies for reasoning models (Claude, Gemini 3)
**Transcribed:** 2025-01-23

---

## Introduction: Gemini 3's Surprising Capabilities

Google's Gemini 3 has really exploded everyone's expectations. Its coding and frontend capability is so much better than anything we have ever seen. But one thing people didn't quite realize is how different and important the prompting is for reasoning models like Gemini 3.

In Google's own official documentation, they also mentioned that Gemini 3 is a reasoning model, which totally changes how you should prompt it. One critical component of these reasoning models like Gemini is those generated reasoning tokens. It is very different from other models where we need to have a fully packed prompt to give all the possible context and logic to make it work well.

In fact, quite often you will find the more prompts you give Gemini, the worse the performance. And that's because it is designed to respond to direct and clear instructions. If you give it overly complex prompts, it may overanalyze variables and sometimes be limited by the process you include in those prompts. So it really needs a concise prompt.

But on the other side, it is also extremely sensitive and steerable as a model. Gemini 3 can perform so differently based on simple instructions you give to it.

## The Power of Simple Keywords

For example, if I just prompted "help me build a hello world page," even though its frontend capability is great, it will still generate something generic. But with just one simple keyword like "with a linear style," it immediately creates something very different. You attach image references, the quality and a lot of UI details just dramatically improve.

So as a model, it is extremely steerable and your prompt can make a huge difference. The question is: how do we actually come up with the right amount of prompt that can make the most out of Gemini 3?

---

## How Anthropic 10x'd Frontend Design Through Skills

Well, Anthropic actually released this blog post recently called "Improving Frontend Design Through Skills." It basically introduces a frontend design skill that you can install in Claude Code, and it is making models like Sonnet 4.5 generate almost close to Gemini 3 level of design.

And the most interesting part for me is that this significant improvement is purely driven by a well-crafted prompt they put together that has good balance between being concise and providing useful details.

They uncovered their exact method and process—how do they systematically get the most out of a Claude model through prompt and context engineering. And I think this method just applies across different models, including Gemini 3.

Today I will articulate and break that down for you into a **three-step process** and take you through a real example of how I craft a prompt that can get even smaller models to output high-quality Excalidraw wireframes.

---

## The Foundation: Distributional Convergence

But before we dive into this Anthropic example, we already know that one single well-crafted prompt can completely transform model behavior, and this goes way beyond just frontend design.

The most interesting concept here is **distributional convergence**, which means during the sampling process, the models predict tokens based on statistical patterns in training data. Safe design choices—those that work universally and offend no one—dominate web training data. So by default, those models almost always revert back to the safe design choices.

And this just applies to much more than frontend design. It can be used for requests like debugging Python, analyzing data, or even writing emails.

---

## The 3-Step Prompt Engineering Process

The method to come up with this set of prompts is pretty consistent. You want to:

### Step 1: Identify Convergent Defaults

You want to get a good understanding for the specific task that you want the model to do. What are the out-of-box default behaviors? Identify those convergent defaults that you don't like.

### Step 2: Provide Concrete Alternatives

Then provide very concrete alternatives and structure the guidance at the right altitude.

### Step 3: Iterate and Refine

Repeat this process again and again until you can come up with a well-crafted prompt that covers specifically those areas and generates stunning outputs consistently.

---

## Applying the Method: Frontend Design

In this very specific example, they started to identify some key areas that impact final design output where the model's default output is not that great, which specifically are:
- **Typography**
- **Animations**
- **Background effects**
- **Themes**

Then translate all those things clearly into code that Claude can write.

### The Right Altitude

The key here is the **right altitude** of the prompt you put in. Often we will be writing too specific prompts where you just list out very specific steps 1, 2, 3, 4, 5 and get the agent to follow. But this often makes your system overfit to a few very specific scenarios and makes it vulnerable for real-world long-tail use cases.

And the key thing to get to just the right level of altitude for the problem is going through this three-step process of testing and identifying those convergent defaults that you don't really like, and then finding a root cause about why the model has that behavior. Then structure a guidance with concrete alternative behavior that you want the model to follow, and just repeat this process again and again.

### Example: Typography

So in the end, you can come up with a well-crafted prompt that covers specifically those areas and generates stunning outputs consistently. One example here is **typography**.

I would just start by prompting the model directly without any system prompt to see what kind of default results we will get. When I asked to create a music player, this default result it gave me has this classic purple-bluish color and this font that looks a bit boring.

**What Anthropic did** is that they added this section called "use interesting fonts" where it will give overall instructions like:
- Avoid using boring, generic fonts
- Which includes Inter, Roboto, Open Sans, Lato, and default system fonts
- Here are some examples that it gives for different scenarios as well as some pairing principles, like which type of fonts work well together

So if I copy this and just put it into the system prompt here as a section to correct those default behaviors and generate again, now you can see that it starts using fonts that are not part of the out-of-box vanilla design.

### The Ripple Effect

And really cool observation here is that **once the model improves one aspect of the design, it generally starts to improve across all the other behaviors** like colors, interactions, and the UI model.

That's why this improvement process is an iterative loop. You try to understand what are the exact things that actually change the model behavior and only add those ones, because every new prompt section you add in might already impact some other behaviors. So you don't need to overly inject tokens.

And similarly, we can add more sections for things like interactions, animations, and use high-quality stock images to steer the model to certain behaviors. Based on that, the result generated will be a bit fancier and crazier.

---

## Accessing Anthropic's Frontend Design Skill

If you want to learn exactly what Anthropic wrote officially, you can just do:

```bash
/plugin marketplace add anthropic/claude-code
```

And then do:

```bash
/plugin install frontend-design@cloud-code-plugins
```

This will add the frontend design skill to your computer directly.

If you're on Mac, you can open this `.claude` folder and inside `plugin/marketplace/anthropic/claude-code-plugins`, you should see this `frontend-design` skill, and you can open the `SKILL.md` file to learn exactly the prompt that they wrote.

---

## Case Study: Training Models for Excalidraw Generation

I use the same method to come up with a UI prompt that I found to get Gemini 3.0 to be extremely creative on the UI generated. Meanwhile, I also want to show you how you can use similar methodology to tune the model for other different types of tasks.

For example, I'm trying to teach a super design agent to be able to design high-quality Excalidraw wireframes so it can be used to align with users about specific design layouts and explore multiple different versions of design.

At default, the model is not that great at producing high-quality results consistently. But with proper prompt engineering, I was able to get it to produce much more high-quality results. And this is how I came up with that prompt.

### Step 1: Identify the Convergent Defaults

First thing you want to do is identify the convergent defaults. Basically, you want to identify what are the model's default behaviors and where does it fall short.

The way we do that is first, let's try with the most basic and minimum prompt that helps you understand the model's default behavior. In our specific case, I'll just give a bare minimum prompt:

```
You're a professional UX engineer who creates clean Excalidraw wireframe designs.
```

**Initial Problems:**
So here you can see that it didn't output the JSON we want. So I can turn on this JSON mode and start adding the first prompt:

```
Only output JSON format in this specific structure
```

And here you can see I'm using the XML format. XML format has been proven to work especially when you have a large number of documents or files to input. Context in general has better performance than JSON structure.

So with this one we can try again. However, nothing happened when I tried to paste. I'm going to assume there's something wrong with the JSON generated. So I paste it in GPT and ask it to help me identify any issues in JSON above.

**What I Found:**
Now I can see it starts identifying some issues like:
- The model is making up some types that didn't really exist for Excalidraw
- For lines, it should not use the x, y, width, and height; instead, it should be using point coordinates

So if we remove these two line items that have the wrong data format as well as the circle, then it does output a result, which didn't look very correct. And we're going to add more rules to it when those text elements are not formatted as well and those layouts are not exactly correct.

### Step 2: Understand the Root Cause

So with just a few quick tests, we already start identifying some gaps with the model's default behavior like:
- Using the wrong element schema
- The wrong ways for text and layout alignment

And at this point, there's one common mistake that people often make: you start adding rules to the prompt that are too specific or not instructive enough to actually change the model's fundamental behavior.

**The Debug Technique:**
One thing I found really useful is to actually try to understand **why** the model's default behavior is like that. One thing I often do is when the model outputs results that I'm not really happy with, I can insert a next user message to be:

```
Debug mode. Don't generate again.
Just help me understand why do you set a width to be zero for type text?
```

And turn off JSON mode so I can regenerate it.

And this is a really good way for you to identify the root cause and defects in the model's knowledge. And here you can see that it says it set the width to be zero because it saw the text will be rendered with intrinsic width, which means it expects the width to be dynamically auto-resized based on the text content—which is not actually the case in Excalidraw.

**This is a critical insight.** So instead of just saying "width and height should not be zero," I would tell it what's the right way to define it.

### Step 3: Provide Concrete Alternatives at the Right Altitude

The best way I found to make the text aligned is making sure the actual width of the text element is the same as the main container and just use the text align property to control the specific position of text. And this is exactly what I put in there.

And this is where **your domain knowledge comes in**, because to provide those alternative solutions, I have to start developing an understanding of the actual Excalidraw JSON schema—what kind of properties it has and what are the effective ways to control those elements.

Once I have this new prompt, I can delete the previous conversation history and try again.

Great! So you can see this new version is a lot better than the previous one.

### Finding the Right Altitude

But meanwhile, another very important thing when you write this prompt is that you want to make sure the guidance you give is at the **right altitude**.

**The Problem:**
One problem I had with the JSON it generated at the moment is that it includes things that we don't really need or didn't really impact the style, like `version`, `deleted`—stuff like that.

**The Wrong Approach:**
And in those types of scenarios, it's very common or easy for us to give very specific concrete prompts like I can define for each type what are the specific properties they should include.

**The Better Approach:**
But the one that probably will work better is that you start articulating what is the reasoning behind those behaviors. So instead of giving very specific instructions like this, I can just say:

```
Only output properties that impact styling.
Never output things like seed, version, things like that
that didn't really contribute to styling.
```

So we basically repeat this loop a few times until you get a prompt that covers all those default convergent behaviors. Then you have a well-crafted prompt for your specific scenario and use case.

---

## Real-World Results

I use the same method to come up with a UI prompt that I found to get Gemini 3.0 to be extremely creative on the UI generated. Like this is a one-shot example for:
- A to-do app
- A fashion shoe brand landing page
- A music recording UI

And we just packed everything into a design agent with Gemini 3 on superdesign.dev that is capable of generating super high-quality UI generation. We also integrated the wireframe capability too, so you can show multiple different versions of wireframes to align ideas with you very quickly.

And you can mix and match different wireframes and UI together and ask AI to remix something new exactly in the way you want.

So we're really excited about what we can do with all those new model capabilities that came out for a full-stack product design agent. So if you're interested, you can check out **superdesign.dev**.

---

## Key Takeaways

### For Reasoning Models (Gemini 3, Claude):

1. **Less is More:** Reasoning models perform worse with overly complex prompts
2. **Be Direct:** Use clear, concise instructions
3. **Extreme Steerability:** Simple keywords can dramatically change outputs
4. **Avoid Over-Specification:** Don't limit the model's reasoning with rigid step-by-step processes

### The Universal 3-Step Process:

**Step 1: Identify Convergent Defaults**
- Test with minimal prompts
- Observe default behaviors
- Identify what you don't like

**Step 2: Understand Root Causes**
- Use "debug mode" to ask the model why it made certain choices
- Don't just add rules—understand the underlying reasoning gaps
- Develop domain knowledge of what you're trying to generate

**Step 3: Provide Guidance at the Right Altitude**
- Not too specific (avoiding overfitting)
- Not too vague (assuming shared context)
- Focus on reasoning principles, not rigid step-by-step instructions
- Give concrete alternatives to unwanted defaults

### Iterative Refinement:

- Each improvement can trigger improvements in other areas
- Only add what's necessary—every prompt section impacts behavior
- Test, refine, repeat until you achieve consistent quality

### Domain Knowledge Matters:

To create effective alternative guidance, you need to understand:
- The actual capabilities and constraints of what you're generating
- The schemas, properties, or patterns that control the output
- The "right way" to achieve the desired results

---

## Conclusion

The same methodology that Anthropic used to 10x Claude Sonnet 4.5's frontend design capabilities applies across all reasoning models, including Gemini 3. Whether you're working on UI generation, Excalidraw wireframes, or any other specialized task, this three-step process of identifying defaults, understanding root causes, and providing properly-scoped guidance will help you unlock the full potential of these powerful models.

The key insight is that **reasoning models don't need exhaustive instructions—they need the right conceptual framework** at the right altitude to steer their inherent capabilities in the direction you want.

---

## Resources

- **Anthropic Frontend Design Skill:** Install via Claude Code plugin marketplace
- **superdesign.dev:** Full-stack product design agent using these prompting techniques
- **Anthropic Blog:** "Improving Frontend Design Through Skills"
- **Google Documentation:** Gemini 3 prompting best practices

Thank you, and see you next time!
