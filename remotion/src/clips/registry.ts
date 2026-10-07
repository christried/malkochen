import { CLIP_IDS, type ClipId } from "../briefs";
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
import { notUnlocked } from "./not-unlocked";
import { offline } from "./offline";
import { searchEmpty } from "./search-empty";
import { splash } from "./splash";
import { topfbertWow } from "./topfbert-wow";

// One clip per brief: leaving one out is a type error.
const BY_ID: Record<ClipId, Clip> = {
  "empty-board": emptyBoard,
  "empty-column": emptyColumn,
  "search-empty": searchEmpty,
  "lookup-stir": lookupStir,
  "lookup-failed": lookupFailed,
  "milestone-10x": milestone10x,
  "board-created": boardCreated,
  "invite-intro": inviteIntro,
  "invite-loop": inviteLoop,
  splash,
  "topfbert-wow": topfbertWow,
  "not-unlocked": notUnlocked,
  offline,
  error,
};

// Every state, system and celebration clip, in the briefs' order.
export const CLIPS: Clip[] = CLIP_IDS.map((id) => BY_ID[id]);

export const clipById = (id: ClipId): Clip => BY_ID[id];
