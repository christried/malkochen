import type { ColumnView } from '~~/server/utils/columns'
import type { CookingView } from '~~/server/utils/cookings'
import type { BulkBody } from '~~/server/utils/dish-input'
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
    addColumn: (boardId, name) => asWrite(postColumn(boardId, name)),
    moveDishes: (dishIds, columnId) => asWrite(bulk({ action: 'move', dishIds, columnId })),
    placeDishes: places => asWrite(bulk({ action: 'place', places })),
    deleteDishes: dishIds => asWrite(bulk({ action: 'delete', dishIds })).then(() => undefined),
    restoreDishes: dishIds => asWrite(bulk({ action: 'restore', dishIds })),
  }
}

// Several Dishes at once (#218); a delete answers nothing.
function bulk(body: BulkBody): Promise<PlacedDish[]> {
  return $fetch<PlacedDish[]>('/api/dishes/bulk', { method: 'POST', body })
}

// Adds a Column at the end of a Board: from the Board's add lane (through
// the Board module) and from Board settings.
export function postColumn(boardId: string, name: string): Promise<ColumnView> {
  return $fetch<ColumnView>(`/api/boards/${boardId}/columns`, { method: 'POST', body: { name } })
}

// A request that fails with WriteFailed and its status.
function asWrite<T>(request: Promise<T>): Promise<T> {
  return request.catch((error: { statusCode?: number }) => {
    throw new WriteFailed(error.statusCode)
  })
}
