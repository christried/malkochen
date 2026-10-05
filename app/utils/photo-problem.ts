import type { PhotoProblem } from '~/composables/usePhotoUpload'
import type { Strings } from '~/strings/de'

// What a Member is told when their photo wasn't taken: an own photo of a Dish
// and a Profile Picture alike.
export function photoProblemMessage(t: Strings, problem: PhotoProblem): string {
  return ({
    'too-large': t.imageDialog.tooLarge,
    'not-an-image': t.imageDialog.notAnImage,
    'failed': t.imageDialog.failed,
  } satisfies Record<PhotoProblem, string>)[problem]
}
