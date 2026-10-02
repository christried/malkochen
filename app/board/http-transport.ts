import type { PlacedDish } from '~~/server/utils/dishes'
import { WriteFailed, type BoardTransport } from './board-module'

// The client Board module's writes over HTTP, for the app. Each is counted
// while under way (trackWrite), so polling drops an answer that would undo
// it for a moment. A failed request rejects with WriteFailed and its status.
export function httpTransport(): BoardTransport {
  return {
    deleteDish: dishId => sent($fetch<unknown>(`/api/dishes/${dishId}`, { method: 'DELETE' })).then(() => undefined),
    restoreDish: dishId => sent($fetch<PlacedDish>(`/api/dishes/${dishId}/restore`, { method: 'POST' })),
  }
}

function sent<T>(request: Promise<T>): Promise<T> {
  return trackWrite(request).catch((error: { statusCode?: number }) => {
    throw new WriteFailed(error.statusCode)
  })
}
