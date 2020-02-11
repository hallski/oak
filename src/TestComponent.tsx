import React, { FC, useCallback } from "react"
import { EffectHandler, Init, next, Update, useOak } from "./oak"

type RemoteData<T> = "initial" | "loading" | T

export function isFetched<T>(remote: RemoteData<T>): remote is T {
  return remote !== "initial" && remote !== "loading"
}

const initialState = {
  value: "initial" as RemoteData<string>,
  foobar: "Not pressed"
}
type State = typeof initialState

const fetchPost = (): Promise<Action> =>
  fetch("https://jsonplaceholder.typicode.com/posts/1")
    .then(response => response.json())
    .then(json => ({ type: "Result", value: json.title }))

type Action =
  | { type: "DelayDone" }
  | { type: "Result"; value: string }
  | { type: "ButtonClicked" }

enum Effect {
  FetchPost,
  Timeout
}
const init: Init<State, Effect> = next(initialState, Effect.Timeout)
//type Effect = { type: "FetchPost" } | { type: "Timeout"; duration: number }

const update: Update<State, Action, Effect> = (state, msg) => {
  switch (msg.type) {
    case "DelayDone":
      return next({ ...state, value: "loading" }, Effect.FetchPost)
    case "Result":
      return next({ ...state, value: msg.value })
    case "ButtonClicked":
      return next({ ...state, foobar: "I've been pressed" })
  }
}

const effectHandler: EffectHandler<Action, Effect> = dispatch => effect => {
  switch (effect) {
    case Effect.FetchPost:
      fetchPost().then(action => dispatch(action))
      break
    case Effect.Timeout:
      setTimeout(() => dispatch({ type: "DelayDone" }), 1000)
      break
  }
}

export const TestComponent: FC = () => {
  const [state, dispatch] = useOak(update, init, effectHandler, {
    log: true
  })
  const clicked = useCallback(() => dispatch({ type: "ButtonClicked" }), [
    dispatch
  ])

  if (state.value === "initial") {
    return <p>Haven't started yet</p>
  }

  if (state.value === "loading") {
    return <p>Loading...</p>
  }

  return (
    <div>
      <p>{state.value}</p>
      <button onClick={clicked}>Press me</button>
      <p>{state.foobar}</p>
    </div>
  )
}
