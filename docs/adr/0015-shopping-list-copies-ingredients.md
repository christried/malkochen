# The Shopping List copies Ingredients, it isn't derived from the Week Plan

## Context

A Board's Shopping List (`CONTEXT.md` → Shopping List, Shopping Item) holds what its Members need to buy for the Dishes they mean to cook. Its lines could be derived live from the Ingredients of the Dishes on the Week Plan, or copied in when a Member puts a Dish on the list.

## Decision

The Shopping List copies. A Member puts a Dish on the list ("Auf die Einkaufsliste", or the whole week from the Week Plan), and its Ingredients are copied in as Shopping Items of their own. Once on the list, a Shopping Item no longer follows the Recipe or the Week Plan: Members change, delete, tick and clear it on its own. Amounts are never added up; two Dishes needing flour give two lines.

Rejected: deriving it from the Week Plan (a tick has nothing stable to hang on once a Recipe line is edited, salt the group already has can't be left out, and Boards that don't use the Week Plan get no list), and summing amounts (Ingredients are plain text without amounts, ADR 0013).

## Consequences

- Editing a Recipe after its Dish went on the list changes nothing there; Members change the Shopping Item by hand.
- Unplanning a Dish leaves its Shopping Items; Members delete them.
- Putting the same Dish on twice gives its lines twice, which stands in for doubled amounts.
- Structured Ingredients later could merge lines when they're put on, without changing what a Shopping Item is.
