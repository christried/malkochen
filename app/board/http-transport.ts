import type { CookingView } from '~~/server/utils/cookings'
import type { CreatedDish, MovedDish, PlacedDish, SavedDish } from '~~/server/utils/dishes'
import { WriteFailed, type BoardTransport } from './board-module'

// The client Board module's writes over HTTP, for the app. Each is counted
// while under way (trackWrite), so polling drops an answer that would undo
// it for a moment. A failed request rejects with WriteFailed and its status.
export function httpTransport(): BoardTransport {
  return {
    addDish: (boardId, dish) => tracked($fetch<CreatedDish>(`/api/boards/${boardId}/dishes`, { method: 'POST', body: dish })),
    editDish: (dishId, changes) => tracked($fetch<SavedDish>(`/api/dishes/${dishId}`, { method: 'PATCH', body: changes })),
    deleteDish: dishId => tracked($fetch<unknown>(`/api/dishes/${dishId}`, { method: 'DELETE' })).then(() => undefined),
    restoreDish: dishId => tracked($fetch<PlacedDish>(`/api/dishes/${dishId}/restore`, { method: 'POST' })),
    moveDish: (dishId, to) => tracked($fetch<MovedDish>(`/api/dishes/${dishId}/move`, { method: 'POST', body: to })),
    cookDish: dishId => tracked($fetch<MovedDish>(`/api/dishes/${dishId}/cook`, { method: 'POST' })),
    undoCooking: (cookingId, to) => tracked($fetch<PlacedDish>(`/api/cookings/${cookingId}/undo`, { method: 'POST', body: to })),
    deleteCooking: cookingId => tracked($fetch<unknown>(`/api/cookings/${cookingId}`, { method: 'DELETE' })).then(() => undefined),
    restoreCooking: cookingId => tracked($fetch<CookingView>(`/api/cookings/${cookingId}/restore`, { method: 'POST' })),
    noteCooking: (cookingId, note) => tracked($fetch<CookingView>(`/api/cookings/${cookingId}`, { method: 'PATCH', body: { note } })),
  }
}

// Counts a write while under way, failing with WriteFailed.
function tracked<T>(request: Promise<T>): Promise<T> {
  return trackWrite(request).catch((error: { statusCode?: number }) => {
    throw new WriteFailed(error.statusCode)
  })
}
