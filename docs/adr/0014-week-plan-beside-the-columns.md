# The Week Plan sits beside the Columns

Decided in the grilling session on 2026-11-12, from Idea [#491](https://github.com/christried/malkochen/issues/491).

## Context

Groups that plan who cooks what on which day had only a Column for it, "Diese Woche", with no days. A Week Plan (`CONTEXT.md` → Week Plan, Planned Dish) adds the days. It could relate to the Columns in three ways:

- **Fill:** putting a Dish on a day moves it into a planning Column. malkochen only recognises one Column, the Gekocht Column. "Diese Woche" is a default name that Members rename or delete, so this would need a second special Column that every Board always keeps, and a migration to choose one on every existing Board.
- **Replace:** the Week Plan takes over "Diese Woche"'s job, and Boards lose that Column or keep it as one more plain Column.
- **Beside:** the Week Plan is a view of its own. A Dish on a day stays in whatever Column it's in.

## Decision

The Week Plan sits beside the Columns. Planning a Dish never moves it, and moving a Dish between Columns never plans or unplans it. The only link is the Cooking. "Gekocht ✓" on today's Planned Dish records a Cooking and moves the Dish into the Gekocht Column, as it does on the card. A Planned Dish shows as cooked when its Dish has a Cooking dated that day, which is read from the Cookings and not stored.

## Consequences

- Boards don't change, and no second special Column exists. A group that likes "Diese Woche" keeps it, and a group that plans by day uses the Week Plan.
- The two can drift: a Dish can be on Thursday's plan while it sits in Ideen. This is accepted. Columns say where a Dish stands, and the Week Plan says when it's meant to be cooked.
- A day passing records no Cooking (ADR 0003: a Cooking is an occasion someone cooked).
- Nothing about the Week Plan shows on the Dish's card or detail, so the Columns screen looks the same with or without a plan.
