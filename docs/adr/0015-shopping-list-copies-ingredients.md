# The Shopping List copies Ingredients, it isn't derived from the Week Plan

Decided in the grilling session on 2026-11-12, from Idea [#489](https://github.com/christried/malkochen/issues/489).

## Context

A Board's Shopping List (`CONTEXT.md` → Shopping List, Shopping Item) holds what its Members need to buy for the Dishes they mean to cook. Its lines could come about in two ways:

- **Derived:** the list is computed, live, from the Ingredients of the Dishes planned on the Week Plan for some days, with ticks stored beside it.
- **Copied:** a Member puts a Dish on the list ("Auf die Einkaufsliste", or the whole week from the Week Plan), and its Ingredients are copied in as Shopping Items of their own.

## Decision

The Shopping List copies. A Shopping Item, once on the list, no longer follows the Recipe or the Week Plan: Members change, delete, tick and clear it on its own. Amounts are never added up; two Dishes needing flour give two lines.

## Considered Options

- **Derived from the Week Plan:** always up to date, but a tick has nothing stable to hang on once a Recipe line is edited, salt the group already has can't be left out, and Boards that don't use the Week Plan get no list.
- **Derived and summed:** would add "200 g Mehl" and "100 g Mehl" up. Ingredients are plain text without amounts (ADR 0013), so this waits on structured Ingredients, a separate decision.

## Consequences

- Editing a Recipe after its Dish went on the list changes nothing there; Members change the Shopping Item by hand.
- Unplanning a Dish leaves its Shopping Items; Members delete them.
- Putting the same Dish on twice gives its lines twice, which stands in for doubled amounts.
- Structured Ingredients later could merge lines when they're put on, without changing what a Shopping Item is.
