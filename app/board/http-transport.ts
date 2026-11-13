import type { ColumnView } from '~~/server/utils/columns'
import type { CommentView } from '~~/server/utils/comments'
import type { CookingView } from '~~/server/utils/cookings'
import type { BulkBody } from '~~/server/utils/dish-input'
import type { DishHistory } from '~~/server/utils/dish-history'
import type { AddedDish, CookedDish, MovedDish, PlacedDish, SavedDish } from '~~/server/utils/dishes'
import type { VoteView } from '~~/server/utils/votes'
import type { PlannedDishView } from '~~/server/utils/week-plan'
import type { ShoppingItemView, WeekPutOn } from '~~/shared/shopping-list'
import type { RecipeSearchAnswer } from '~~/shared/recipe'
import type { BoardTransport } from './board-module'
import { gotNoAnswer, WriteFailed } from './write-failed'

// The client Board module's writes over HTTP, for the app. A failed request
// rejects with WriteFailed and its status.
export function httpTransport(): BoardTransport {
  return {
    addDish: (boardId, dish) => asWrite($fetch<AddedDish>(`/api/boards/${boardId}/dishes`, { method: 'POST', body: dish })),
    addDishLate: (boardId, dish) => asWrite($fetch<AddedDish>(`/api/boards/${boardId}/dishes`, { method: 'POST', body: dish })),
    editDish: (dishId, changes) => asWrite($fetch<SavedDish>(`/api/dishes/${dishId}`, { method: 'PATCH', body: changes })),
    findRecipe: dishId => asWrite($fetch<RecipeSearchAnswer>(`/api/dishes/${dishId}/find-recipe`, { method: 'POST' })),
    deleteDish: dishId => asWrite($fetch<unknown>(`/api/dishes/${dishId}`, { method: 'DELETE' })).then(() => undefined),
    restoreDish: dishId => asWrite($fetch<PlacedDish>(`/api/dishes/${dishId}/restore`, { method: 'POST' })),
    moveDish: (dishId, to, late) => asWrite($fetch<MovedDish>(`/api/dishes/${dishId}/move`, { method: 'POST', body: { ...to, ...late } })),
    cookDish: (dishId, late) => asWrite($fetch<MovedDish>(`/api/dishes/${dishId}/cook`, { method: 'POST', body: { ...late } })),
    undoCooking: (cookingId, to) => asWrite($fetch<PlacedDish>(`/api/cookings/${cookingId}/undo`, { method: 'POST', body: to })),
    deleteCooking: cookingId => asWrite($fetch<unknown>(`/api/cookings/${cookingId}`, { method: 'DELETE' })).then(() => undefined),
    restoreCooking: cookingId => asWrite($fetch<CookingView>(`/api/cookings/${cookingId}/restore`, { method: 'POST' })),
    addColumn: (boardId, name) => asWrite(postColumn(boardId, name)),
    moveDishes: (dishIds, columnId) => asWrite(bulk({ action: 'move', dishIds, columnId })),
    placeDishes: places => asWrite(bulk({ action: 'place', places })),
    deleteDishes: dishIds => asWrite(bulk({ action: 'delete', dishIds })).then(() => undefined),
    restoreDishes: dishIds => asWrite(bulk({ action: 'restore', dishIds })),
    cookDishes: (dishIds, late) => asWrite(bulk({ action: 'cook', dishIds, ...late }) as Promise<CookedDish[]>),
    uncookDishes: cookings => asWrite(bulk({ action: 'uncook', cookings })),
    planDish: (boardId, plan, late) => asWrite($fetch<PlannedDishView>(`/api/boards/${boardId}/planned-dishes`, { method: 'POST', body: { ...plan, ...late } })),
    movePlannedDish: (plannedId, to, late) => asWrite($fetch<PlannedDishView>(`/api/planned-dishes/${plannedId}`, { method: 'PATCH', body: { ...to, ...late } })),
    unplanDish: (plannedId, late) => asWrite($fetch<unknown>(`/api/planned-dishes/${plannedId}`, { method: 'DELETE', body: { ...late } })).then(() => undefined),
    setPlannedDishCook: (plannedId, cookId, late) => asWrite($fetch<PlannedDishView>(`/api/planned-dishes/${plannedId}/cook`, { method: 'PUT', body: { cookId, ...late } })),
    addShoppingItem: (boardId, item, late) => asWrite($fetch<ShoppingItemView>(`/api/boards/${boardId}/shopping-items`, { method: 'POST', body: { ...item, ...late } })),
    changeShoppingItem: (itemId, change, late) => asWrite($fetch<ShoppingItemView>(`/api/shopping-items/${itemId}`, { method: 'PATCH', body: { ...change, ...late } })),
    deleteShoppingItem: (itemId, late) => asWrite($fetch<unknown>(`/api/shopping-items/${itemId}`, { method: 'DELETE', body: { ...late } })).then(() => undefined),
    clearShoppingItems: (boardId, late) => asWrite($fetch<{ ids: string[] }>(`/api/boards/${boardId}/shopping-items/clear`, { method: 'POST', body: { ...late } })),
    restoreShoppingItems: (boardId, ids, late) => asWrite($fetch<ShoppingItemView[]>(`/api/boards/${boardId}/shopping-items/restore`, { method: 'POST', body: { ids, ...late } })),
    takeBackShoppingItems: (boardId, ids, late) => asWrite($fetch<{ ids: string[] }>(`/api/boards/${boardId}/shopping-items/take-back`, { method: 'POST', body: { ids, ...late } })),
    putDishOnShoppingList: (boardId, put, late) => asWrite($fetch<ShoppingItemView[]>(`/api/boards/${boardId}/shopping-items/dish`, { method: 'POST', body: { ...put, ...late } })),
    putWeekOnShoppingList: (boardId, week, late) => asWrite($fetch<WeekPutOn>(`/api/boards/${boardId}/shopping-items/week`, { method: 'POST', body: { week, ...late } })),
    openDish: dishId => asWrite($fetch<DishHistory>(`/api/dishes/${dishId}/open`, { method: 'POST' })),
    writeComment: (dishId, text, late) => asWrite($fetch<CommentView>(`/api/dishes/${dishId}/comments`, { method: 'POST', body: { text, ...late } })),
    editComment: (commentId, text) => asWrite($fetch<CommentView>(`/api/comments/${commentId}`, { method: 'PATCH', body: { text } })),
    deleteComment: commentId => asWrite($fetch<unknown>(`/api/comments/${commentId}`, { method: 'DELETE' })).then(() => undefined),
    restoreComment: commentId => asWrite($fetch<CommentView>(`/api/comments/${commentId}/restore`, { method: 'POST' })),
    setVote: (dishId, up, late) => asWrite($fetch<VoteView>(`/api/dishes/${dishId}/vote`, { method: 'PUT', body: { up, ...late } })),
    takeBackVote: dishId => asWrite($fetch<unknown>(`/api/dishes/${dishId}/vote`, { method: 'DELETE' })).then(() => undefined),
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

// A request that fails with WriteFailed and its status. No answer from
// malkochen (gotNoAnswer: no response, or a Vercel platform error) fails
// without a status.
function asWrite<T>(request: Promise<T>): Promise<T> {
  return request.catch((error: { statusCode?: number }) => {
    throw new WriteFailed(gotNoAnswer(error) ? undefined : error.statusCode)
  })
}
