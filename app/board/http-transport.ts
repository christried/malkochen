import type { CookingView } from '~~/server/utils/cookings'
import type { AddedDish, MovedDish, PlacedDish, SavedDish } from '~~/server/utils/dishes'
import { WriteFailed, type BoardTransport } from './board-module'

// The client Board module's writes over HTTP, for the app. A failed request
// rejects with WriteFailed and its status.
export function httpTransport(): BoardTransport {
  return {
    addDish: (boardId, dish) => asWrite($fetch<AddedDish>(`/api/boards/${boardId}/dishes`, { method: 'POST', body: dish })),
    editDish: (dishId, changes) => asWrite($fetch<SavedDish>(`/api/dishes/${dishId}`, { method: 'PATCH', body: changes })),
    deleteDish: dishId => asWrite($fetch<unknown>(`/api/dishes/${dishId}`, { method: 'DELETE' })).then(() => undefined),
    restoreDish: dishId => asWrite($fetch<PlacedDish>(`/api/dishes/${dishId}/restore`, { method: 'POST' })),
    moveDish: (dishId, to) => asWrite($fetch<MovedDish>(`/api/dishes/${dishId}/move`, { method: 'POST', body: to })),
    cookDish: dishId => asWrite($fetch<MovedDish>(`/api/dishes/${dishId}/cook`, { method: 'POST' })),
    undoCooking: (cookingId, to) => asWrite($fetch<PlacedDish>(`/api/cookings/${cookingId}/undo`, { method: 'POST', body: to })),
    deleteCooking: cookingId => asWrite($fetch<unknown>(`/api/cookings/${cookingId}`, { method: 'DELETE' })).then(() => undefined),
    restoreCooking: cookingId => asWrite($fetch<CookingView>(`/api/cookings/${cookingId}/restore`, { method: 'POST' })),
    noteCooking: (cookingId, note) => asWrite($fetch<CookingView>(`/api/cookings/${cookingId}`, { method: 'PATCH', body: { note } })),
  }
}

// A request that fails with WriteFailed and its status.
function asWrite<T>(request: Promise<T>): Promise<T> {
  return request.catch((error: { statusCode?: number }) => {
    throw new WriteFailed(error.statusCode)
  })
}
