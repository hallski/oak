import React, { FC, useContext } from "react"
import { EffectHandler, Init, next, Update, useOak } from "./oak"

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

type AppEffect = { type: "FetchTodos" } | { type: "Timeout"; duration: number }

const init: Init<State, AppEffect> = next(initialState)

export const update: Update<State, AppAction, AppEffect> = (state, msg) => {
  switch (msg.type) {
    case "Add":
      return next(
        { ...state, result: msg.x + msg.y },
        { type: "Timeout", duration: 2000 }
      )
    case "GotResult":
      return next({ ...state, httpResult: msg.data })
    case "AfterTimeout":
      const cmd =
        state.httpResult === "initial"
          ? ({ type: "FetchTodos" } as AppEffect)
          : undefined
      return next({ ...state, timeoutDone: true, httpResult: "loading" }, cmd)
  }
}

const effectHandler: EffectHandler<
  AppAction,
  AppEffect
> = dispatch => effect => {
  switch (effect.type) {
    case "FetchTodos":
      fetch("https://jsonplaceholder.typicode.com/todos/1")
        .then(result => result.json())
        .then(json => ({ type: "GotResult", data: json.title } as AppAction))
        .then(dispatch)
      break
    case "Timeout":
      setTimeout(() => dispatch({ type: "AfterTimeout" }), effect.duration)
      break
  }
}

const DispatchContext = React.createContext((_: AppAction) => {})
const StateContext = React.createContext(initialState)

export const AppStateProvider: FC = ({ children }) => {
  const [state, dispatch] = useOak(update, init, effectHandler, {
    log: true
  })

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  )
}

export const useDispatch = () => useContext(DispatchContext)
export const useAppState = () => useContext(StateContext)
