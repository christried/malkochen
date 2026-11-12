// Every kind of event in the event log (server/utils/events.ts), as a list so
// the Admin Page can group and label them (shared/admin.ts): a kind added
// here fails typecheck until it is in a group and has a label in every
// language.
export const EVENT_KINDS = [
  'board_created',
  // "Board löschen" (CONTEXT.md: Archived Board).
  'board_archived',
  // An Archived Board its Owner brought back.
  'board_restored',
  // An Archived Board its Owner deleted for good (before #337: any Board
  // its Owner deleted, which was then gone at once).
  'board_deleted',
  'member_joined',
  'member_left',
  'member_removed',
  'dish_added',
  // A Copy (CONTEXT.md: Copy) made on another Board: `dish_id` the Copy, and
  // `details.from` the Dish it was copied from. Not a "Dish added".
  'dish_copied',
  'dish_moved',
  // "Archivieren" (CONTEXT.md: Archived Dish).
  'dish_archived',
  // Brought back from the Archive, or by "Rückgängig" right after.
  'dish_restored',
  // An Archived Dish the Owner deleted for good.
  'dish_deleted',
  // The Week Plan (CONTEXT.md: Week Plan, Planned Dish): a Dish put on a day,
  // a Planned Dish moved to another day or place, and one taken off the plan
  // (the Dish itself stays), and who cooks one set or cleared ("Wer kocht";
  // `details.member` is the cook, absent when cleared). `details.plannedDish`
  // is the Planned Dish.
  'dish_planned',
  'planned_dish_moved',
  'dish_unplanned',
  'planned_dish_cook_set',
  'cooking_recorded',
  'cooking_deleted',
  'cooking_restored',
  // A Comment (CONTEXT.md) written, its text changed by its author,
  // deleted by its author or the Owner, and brought back by "Rückgängig".
  'comment_written',
  'comment_edited',
  'comment_deleted',
  'comment_restored',
  // A Vote (CONTEXT.md) given where the Member had none, changed to the
  // other thumb, and taken back.
  'vote_set',
  'vote_changed',
  'vote_taken_back',
  // The Operator switched Open Sign-up (CONTEXT.md) on or off: an event of
  // malkochen as a whole, on no Board.
  'open_sign_up_switched',
  // "Bearbeiten" on a Dish: which of its fields changed (EventDetails).
  'dish_edited',
  // A Dish's Recipe (CONTEXT.md) changed by a Member, never what it says.
  'recipe_edited',
  // Board settings: Columns added, renamed, given or without a Column
  // Subtitle, put in a new order, and deleted.
  'column_added',
  'column_renamed',
  'column_subtitle_changed',
  'column_reordered',
  'column_deleted',
  // A Member's Permission switched, and the Board's Default Permissions.
  'permission_changed',
  'default_permission_changed',
  // The Invite Link given a new secret, the old one stops working.
  'invite_link_reset',
  'board_renamed',
  'board_emoji_changed',
  // The Owner made another Member the Owner.
  'ownership_handed_over',
  // A new user (Better Auth's user creation), and every sign-in: a session
  // made (a sign-up is followed by its first sign-in).
  'signed_up',
  'signed_in',
  // The user's Username changed (not kept: "Passt dein Name?").
  'username_changed',
  // The user's own Profile Picture set, or removed.
  'picture_changed',
  // The user's language under Sprache changed.
  'language_changed',
  // Push notifications switched on or off for one of the user's devices.
  'push_switched',
  // The Email Digest switched on or off.
  'digest_switched',
  // Snackbert (CONTEXT.md) switched on or off in Your Settings.
  'snackbert_switched',
  // A Snackbert Report (#424) sent for a Cooking: its Board, Dish and user,
  // never what it said or what it showed.
  'snackbert_report_sent',
  // The Recipe Finder's search for a Dish's Recipe (#500, "Rezept finden")
  // ended: it found a Recipe (Dish and Board, by the user who searched), found
  // none for the Dish's Source, or failed because the page didn't answer.
  // Never what it found. Together they count a user's searches.
  'recipe_found',
  'recipe_not_found',
  'recipe_search_failed',
  // A user asked for the Recipe Finder (CONTEXT.md, #497) in Your Settings.
  'recipe_finder_asked',
  // The Operator switched the Recipe Finder on or off for a user (the
  // event's `member`).
  'recipe_finder_switched',
  // A Deleted Account: no user (its others' events lose theirs too).
  'account_deleted',
  // A Push Notification sent to one of a Member's devices, for the Board
  // and Dish it is about (the Dish is null for none).
  'push_sent',
  // An Email Digest sent to a Member.
  'digest_sent',
  // A Notification Prompt (CONTEXT.md) shown to a user, and how they answered
  // it: events of no Board.
  'prompt_shown',
  'prompt_answered',
  // Someone opened a Dish Link page (CONTEXT.md: Dish Link), signed in or not.
  'dish_link_opened',
] as const

export type EventKind = typeof EVENT_KINDS[number]

// The Notification Prompts (CONTEXT.md, #407): which one, and how the user
// answered it ("Einschalten" 'on', "Später" 'later').
export const PROMPT_KINDS = ['push', 'digest'] as const
export type PromptKind = typeof PROMPT_KINDS[number]
export const PROMPT_ANSWERS = ['on', 'later'] as const
export type PromptAnswer = typeof PROMPT_ANSWERS[number]

// The fields of a Dish an edit can change (dish_edited): the title, the
// image (or its Placeholder), the Source, the Creator and the Focus Point.
export type DishField = 'title' | 'image' | 'source' | 'creator' | 'focus'
