# When a Cooking is recorded

## Context

Moving a Dish into the Gekocht Column records a Cooking dated now. That left two cases open: "Gekocht ✓" on a Dish already in the Gekocht Column (nothing moves), and deleting a Column into the Gekocht Column (every one of its Dishes moves there).

## Decision

A Cooking records an occasion someone cooked the Dish, not a change of Column (`CONTEXT.md` → Cooking).

- **"Gekocht ✓" on a Dish already in the Gekocht Column records another Cooking** and leaves the Dish where it is.
- **Deleting a Column into the Gekocht Column records none.** Its Dishes move there, but nobody cooked them.
- Moving a Dish within the Gekocht Column records none.

The rule is `recordsCooking` in [`shared/placement.ts`](../../shared/placement.ts). See also `cookDish` in [`server/utils/dishes.ts`](../../server/utils/dishes.ts), `deleteColumn` in [`server/utils/columns.ts`](../../server/utils/columns.ts), and the tests in [`tests/api/cooking.test.ts`](../../tests/api/cooking.test.ts) and [`tests/api/board-settings.test.ts`](../../tests/api/board-settings.test.ts).

## Consequences

- Achievement Levels count Cookings, so repeated "Gekocht ✓" on a Dish in the Gekocht Column raises its level. Deleting a Column never does.
- Undoing "Gekocht ✓" on a Dish that was already in the Gekocht Column removes only the Cooking. There is no move to undo.
- The celebration plays for every recorded Cooking, including a repeat "Gekocht ✓". It never plays for a Column deletion.
