# PrioSync Product Writing Guidelines

Single internal policy for all user-facing copy (UI strings, toasts, empty
states, docs, release notes). Informed by `petergyang/no-ai-slop` (MIT) and
`jalaalrd/anti-ai-slop-writing` (license file absent upstream - ideas only,
no text copied); the rules below are written originally for PrioSync.

## Non-negotiable rules

1. **Numbers beat adjectives.** Every claim carries its number, unit, and
   scope. "6 hours of work remain against 4 hours of capacity" - never
   "a lot of work remains".
2. **Never invent facts.** No statistics, deadlines, durations, streaks, or
   user behavior that the engine did not compute. If the data is absent, say
   what is missing ("Set a deadline to see risk for this task").
3. **Name the mechanism.** "Blocked by API integration (2 downstream tasks
   waiting)" - never "intelligently orchestrated".
4. **No binary-contrast slogans.** Never "It's not X. It's Y." constructions.
5. **No throat-clearing.** No "Here's the thing", "Let me be clear",
   "Simply", "Seamlessly", "Unlock", "Supercharge", "Revolutionize".
6. **No faux insight.** No "What nobody tells you", "The secret is",
   "pivotal moment", "testament to".
7. **No weasel attribution.** No "experts agree", "studies show",
   "research proves" without a named source.
8. **Errors say what happened + what to do.** "Could not save - check your
   connection and retry." Never "Something went wrong" alone, never blame.
9. **Empty states give one next action.** "No tasks yet - dump your first
   brain dump above." Never decorative apologies.
10. **Keep the user's words.** Task titles and goal text render verbatim;
    the product never paraphrases user content into marketing voice.

## Before / after (real PrioSync copy)

BAD: "Leave them lost for words with seamless priority scoring."
GOOD: "Every task scores 0-100 from urgency, importance, deadline pressure,
and difficulty - and shows exactly which factor contributed what."

BAD: "Unlock your productivity potential with intelligent task orchestration."
GOOD: "6 hours of work remain, but you have 4 hours available today.
PrioSync moved two lower-impact tasks to tomorrow."

## Scope

These rules govern wording only. They never change numbers, ranks, plans,
or schedules - the deterministic engine owns all decisions, and any edit
that alters factual meaning is rejected no matter how good it sounds.
