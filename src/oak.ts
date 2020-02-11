import { useCallback, useEffect, useState } from "react"
import { Observable, Subject } from "rxjs"
import { distinctUntilChanged, map, tap, withLatestFrom } from "rxjs/operators"

export type Dispatch<Action> = (msg: Action) => void
export type EffectHandler<Action, Effect> = (
  dispatch: Dispatch<Action>
) => (effect: Effect) => void

type StrictPropertyCheck<T, TExpected, TError> = Exclude<
  keyof T,
  keyof TExpected
> extends never
  ? {}
  : TError

export type Next<State, Effect> = { state: State; effect?: Effect }

// The state is strictly property checked for excess properties to give better
// feedback when using without having to manually define the types
export const next = <State, Effect, T extends State = State>(
  state: T &
    StrictPropertyCheck<
      T,
      State,
      "Passed in invalid state properties, use next<State, Action>() for more descriptive error"
    >,
  effect?: Effect
): Next<State, Effect> => ({
  state,
  effect
})
export type Init<State, Action> =
  | Next<State, Action>
  | (() => Next<State, Action>)
export type Update<State, Action, Effect> = (
  state: State,
  msg: Action
) => Next<State, Effect>

export type OakOptions = {
  log?: boolean
}

export const setupOak = <State, Action, Effect>(
  updateFunc: Update<State, Action, Effect>,
  effectHandler: EffectHandler<Action, Effect>,
  initialState: State,
  initialEffect?: Effect,
  opts?: OakOptions
): [Observable<State>, Dispatch<Action>] => {
  const log = (opts && opts.log) || false

  const action$ = new Subject<Action>()
  const state$ = new Subject<State>()

  const dispatch: Dispatch<Action> = (action: Action) => action$.next(action)

  const handleEffect = effectHandler(dispatch)

  action$
    .pipe(
      withLatestFrom(state$),
      tap(([msg, state]) => console.log("calling update:", msg, state)),
      map(([msg, state]) => updateFunc(state, msg)),
      tap(next => log && console.log("Update returned:", next)),
      tap(next => next.effect !== undefined && handleEffect(next.effect)),
      map(next => next.state)
    )
    .subscribe(state => state$.next(state))

  state$.next(initialState)
  initialEffect !== undefined && handleEffect(initialEffect)

  return [state$.pipe(distinctUntilChanged()), dispatch]
}

export const useOak = <State, Action, Effect>(
  updateFunc: Update<State, Action, Effect>,
  init: Init<State, Effect>,
  effectHandler: EffectHandler<Action, Effect>,
  opts?: OakOptions
): [State, Dispatch<Action>] => {
  const { state: initialValue, effect: initialEffect } =
    typeof init === "function" ? init() : init
  // Used to trigger hook to re-emit values
  const [state, setState] = useState<State>(initialValue)
  const [oakDispatch, setOakDispatch] = useState<{ d: Dispatch<Action> }>({
    d: () => {}
  })

  useEffect(() => {
    const [state$, d] = setupOak(
      updateFunc,
      effectHandler,
      initialValue,
      initialEffect,
      opts
    )

    setOakDispatch({ d })

    const stateSubscription = state$.subscribe(newState => setState(newState))

    return () => {
      stateSubscription.unsubscribe()
    }
    // eslint-disable-next-line
  }, [])

  const dispatch: Dispatch<Action> = useCallback(
    (msg: Action) => {
      oakDispatch.d(msg)
    },
    [oakDispatch]
  )

  return [state, dispatch]
}
