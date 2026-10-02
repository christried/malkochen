# When a Cooking is recorded

Sharpens spec [#1](https://github.com/christried/malkochen/issues/1) story 49 ("moving a Dish into the Gekocht Column records a Cooking dated now"), story 55 ("cooking a Dish again to add another Cooking") and its Cooking module.

## Context

Story 49 ties a Cooking to entering the Gekocht Column. It leaves two cases open. One is "Gekocht ✓" (story 35) on a Dish that is already in the Gekocht Column: read literally, nothing moves, so nothing would be recorded. The other is deleting a Column into the Gekocht Column (story 58): read literally, every one of its Dishes moves into the Gekocht Column, so each would get a Cooking.

## Decision

A Cooking records an occasion someone cooked the Dish, not a change of Column (`CONTEXT.md` → Cooking).

- **"Gekocht ✓" on a Dish already in the Gekocht Column records another Cooking** and leaves the Dish where it is. This is story 55: a Dish gets cooked again without leaving and re-entering the Gekocht Column.
- **Deleting a Column into the Gekocht Column records none.** Its Dishes move there, but nobody cooked them.
- Moving a Dish within the Gekocht Column records none, as before.

The rule is `recordsCooking` in [`shared/placement.ts`](../../shared/placement.ts). See also `cookDish` in [`server/utils/dishes.ts`](../../server/utils/dishes.ts), `deleteColumn` in [`server/utils/columns.ts`](../../server/utils/columns.ts), and the tests in [`tests/api/cooking.test.ts`](../../tests/api/cooking.test.ts) and [`tests/api/board-settings.test.ts`](../../tests/api/board-settings.test.ts).

## Consequences

- Achievement Levels count Cookings, so repeated "Gekocht ✓" on a Dish in the Gekocht Column raises its level. Deleting a Column never does.
- Undoing "Gekocht ✓" on a Dish that was already in the Gekocht Column removes only the Cooking. There is no move to undo.
- The celebration plays for every recorded Cooking, including a repeat "Gekocht ✓". It never plays for a Column deletion.
