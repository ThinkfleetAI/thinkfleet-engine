---
name: prompt-engineering
description: "Advanced prompting techniques: chain-of-thought, few-shot, system prompts, structured output, and prompt optimization."
metadata: {"thinkfleetbot":{"emoji":"🧠","requires":{"anyBins":["curl","jq"]}}}
---

# Prompt Engineering

Techniques for getting reliable, high-quality output from LLMs.

## Core Techniques

### System Prompt Design
- Define the role, constraints, and output format upfront
- Be explicit about what NOT to do
- Put the most important instructions first

### Chain-of-Thought
Force step-by-step reasoning before the answer:
```
Think through this step by step:
1. First, identify...
2. Then, evaluate...
3. Finally, decide...
```

### Few-Shot Examples
Provide 2-3 examples of input → output pairs before the actual task. Match the exact format you want back.

### Structured Output
Request specific formats:
```
Respond with JSON in this exact format:
{"decision": "approve|reject", "reason": "string", "confidence": 0.0-1.0}
```

## Prompt Patterns

### Persona Pattern
```
You are a senior security engineer reviewing code for vulnerabilities.
Focus only on security issues. Ignore style, naming, and formatting.
```

### Constraint Pattern
```
Rules:
- Maximum 3 sentences per response
- Use only information from the provided context
- If uncertain, say "I don't know" instead of guessing
```

### Verification Pattern
```
After generating your response, verify:
1. Does it answer the original question?
2. Are all claims supported by evidence?
3. Are there any logical contradictions?
If any check fails, revise before responding.
```

### Decomposition Pattern
```
Break this problem into sub-problems:
1. Solve each sub-problem independently
2. Combine the solutions
3. Verify the combined solution
```

## API Usage Patterns

### Claude API

```bash
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "system": "You are a code reviewer. Only flag security issues.",
    "messages": [{"role": "user", "content": "Review this code: ..."}]
  }' | jq '.content[0].text'
```

### OpenAI API

```bash
curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are a code reviewer."},
      {"role": "user", "content": "Review this code: ..."}
    ],
    "response_format": {"type": "json_object"}
  }' | jq '.choices[0].message.content'
```

## Prompt Optimization

### Reduce token usage
- Remove filler words and redundant instructions
- Use examples instead of lengthy descriptions
- Put context in system prompt (cached across turns with some providers)

### Improve reliability
- Ask the model to output reasoning before conclusions
- Use XML tags to delimit sections: `<context>...</context>`
- Be specific: "list 5 items" not "list some items"
- Provide negative examples: "Do NOT include..."

### Test prompts
- Run the same prompt 5 times — if outputs vary wildly, the prompt is ambiguous
- Use temperature 0 for deterministic tasks, 0.7+ for creative tasks
- Compare model outputs across providers for the same prompt

## Notes

- Prompt engineering is empirical — test and iterate, don't theorize.
- Long prompts aren't bad if they reduce ambiguity. Clarity > brevity.
- System prompts are more reliable than user-message instructions for persistent behavior.
- XML tags (`<instructions>`, `<context>`, `<examples>`) help models parse structured prompts.
- Cache-friendly prompts: put static content first, dynamic content last.
