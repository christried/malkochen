// Whether what was typed into "Board löschen?" confirms deleting the Board
// named `name`: its name exactly, case and all, spaces around it aside.
export function confirmsDeletion(typed: string, name: string): boolean {
  return typed.trim() === name
}
