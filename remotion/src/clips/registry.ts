import type { Clip } from "./clip";
import { boardCreated } from "./board-created";
import { emptyBoard } from "./empty-board";
import { emptyColumn } from "./empty-column";
import { error } from "./error";
import { inviteIntro } from "./invite-intro";
import { inviteLoop } from "./invite-loop";
import { lookupFailed } from "./lookup-failed";
import { lookupStir } from "./lookup-stir";
import { milestone10x } from "./milestone-10x";
import { neverCooked } from "./never-cooked";
import { notUnlocked } from "./not-unlocked";
import { offline } from "./offline";
import { searchEmpty } from "./search-empty";
import { splash } from "./splash";
import { topfbertWow } from "./topfbert-wow";

// Every state, system and celebration clip, in the briefs' order.
export const CLIPS: Clip[] = [
  emptyBoard,
  emptyColumn,
  searchEmpty,
  lookupStir,
  lookupFailed,
  neverCooked,
  milestone10x,
  boardCreated,
  inviteIntro,
  inviteLoop,
  splash,
  topfbertWow,
  notUnlocked,
  offline,
  error,
];

export const clipById = (id: string): Clip => {
  const clip = CLIPS.find((c) => c.id === id);
  if (!clip) throw new Error(`No clip ${id}`);
  return clip;
};
