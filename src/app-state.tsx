import React, { FC, useContext } from "react"
import { ajax } from "rxjs/ajax"
import { delay, map } from "rxjs/operators"
import { Init, makeEffect, next, Update, useOak } from "./oak"

export type RemoteData<T> = "initial" | "loading" | T

export function isFetched<T>(remote: RemoteData<T>): remote is T {
  return remote !== "initial" && remote !== "loading"
}

export const initialState = {
  result: 0,
  timeoutDone: false,
  httpResult: "initial" as RemoteData<string>
}

export type State = typeof initialState

type AppAction =
  | { type: "Add"; x: number; y: number }
  | { type: "GotResult"; data: string }
  | { type: "AfterTimeout" }

const init: Init<State, AppAction> = next(initialState)

export const fetchTodos = makeEffect<AppAction>("fetchTodos", () =>
  ajax("https://jsonplaceholder.typicode.com/todos/1").pipe(
    delay(1000),
    map(res => ({ type: "GotResult", data: res.response.title }))
  )
)

export const promiseTimeout = (duration: number) =>
  makeEffect<AppAction, { duration: number }>(
    "promiseTimeout",
    () =>
      new Promise(resolve =>
        setTimeout(() => resolve({ type: "AfterTimeout" }), duration)
      ),
    {
      duration
    }
  )

export const update: Update<State, AppAction> = (state, msg) => {
  switch (msg.type) {
    case "Add":
      return next({ ...state, result: msg.x + msg.y }, promiseTimeout(2000))
    case "GotResult":
      return next({ ...state, httpResult: msg.data })
    case "AfterTimeout":
      const cmd = state.httpResult === "initial" ? fetchTodos : undefined
      return next({ ...state, timeoutDone: true, httpResult: "loading" }, cmd)
  }
}

const DispatchContext = React.createContext((_: AppAction) => {})
const StateContext = React.createContext(initialState)

export const AppStateProvider: FC = ({ children }) => {
  const [state, dispatch] = useOak(update, init, { log: true })

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  )
}

export const useDispatch = () => useContext(DispatchContext)
export const useAppState = () => useContext(StateContext)
