import { update, initialState } from "./app-state"

it("Should run a timeout on Add", () => {
  const { state, effect } = update(initialState, { type: "Add", x: 10, y: 20 })
  expect(state.result).toBe(30)
  expect(effect!).toEqual({ type: "Timeout", duration: 2000 })
})

it("Should request todos after timeout", () => {
  const { state, effect } = update(initialState, { type: "AfterTimeout" })
  expect(state.timeoutDone).toBe(true)
  expect(effect).toEqual({ type: "FetchTodos" })
})
