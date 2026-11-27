# The Week Plan sits beside the Columns

## Context

Groups that plan who cooks what on which day had only a Column for it, "Diese Woche", with no days. A Week Plan (`CONTEXT.md` → Week Plan, Planned Dish) adds the days. Filling a planning Column would need a second special Column every Board keeps (malkochen only recognises the Gekocht Column, and "Diese Woche" is a default name Members rename or delete), and replacing "Diese Woche" would change every Board.

## Decision

The Week Plan sits beside the Columns. Planning a Dish never moves it, and moving a Dish between Columns never plans or unplans it. The only link is the Cooking: "Gekocht ✓" on today's Planned Dish records a Cooking and moves the Dish into the Gekocht Column, as it does on the card. A Planned Dish shows as cooked when its Dish has a Cooking dated that day, which is read from the Cookings and not stored.

## Consequences

- Boards don't change, and no second special Column exists.
- The two can drift: a Dish can be on Thursday's plan while it sits in Ideen. This is accepted. Columns say where a Dish stands, and the Week Plan says when it's meant to be cooked.
- A day passing records no Cooking (ADR 0003: a Cooking is an occasion someone cooked).
- Nothing about the Week Plan shows on the Dish's card or detail, so the Columns screen looks the same with or without a plan.
