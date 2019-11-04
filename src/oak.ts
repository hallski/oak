import { useCallback, useEffect, useState } from "react"
import { Observable, Subject, timer, from } from "rxjs"
import { ajax } from "rxjs/ajax"
import {
  delay,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  share,
  tap,
  withLatestFrom
} from "rxjs/operators"

type EffectResult<Event> = Promise<Event> | Observable<Event>
type EffectRun<Event> = () => EffectResult<Event>

type Effect<Event, Data = any> = {
  name: string
  run: EffectRun<Event>
  data?: Data
}

export const makeEffect = <Event, Data = any>(
  name: string,
  run: EffectRun<Event>,
  data?: Data
): Effect<Event, Data> => ({
  name,
  run,
  data
})

type StrictPropertyCheck<T, TExpected, TError> = Exclude<
  keyof T,
  keyof TExpected
> extends never
  ? {}
  : TError

export type Next<State, Action> = { state: State; effect?: Effect<Action> }

const observableFromEffectResult = <Event>(
  result: EffectResult<Event>
): Observable<Event> => (result instanceof Promise ? from(result) : result)

// The state is strictly property checked for excess properties to give better
// feedback when using without having to manually define the types
export const next = <State, Event, T extends State = State>(
  state: T &
    StrictPropertyCheck<
      T,
      State,
      "Passed in invalid state properties, use next<State, Event>() for more descriptive error"
    >,
  effect?: Effect<Event>
): Next<State, Event> => ({
  state,
  effect
})
export type Init<State, Event> = Next<State, Event> | (() => Next<State, Event>)
export type Update<State, Event> = (
  state: State,
  msg: Event
) => Next<State, Event>

export type Dispatch<Event> = (msg: Event) => void

function isEffect<Event>(effect?: Effect<Event>): effect is Effect<Event> {
  return !!effect
}

export type OakOptions = {
  log?: boolean
}

export const useOak = <State, Event>(
  updateFunc: Update<State, Event>,
  init: Init<State, Event>,
  opts?: OakOptions
): [State, Dispatch<Event>] => {
  const { state: initialValue, effect: initialEffect } =
    typeof init === "function" ? init() : init
  const [state$] = useState(new Subject<State>())
  const [msg$] = useState(new Subject<Event>())

  // Used to trigger hook to re-emit values
  const [state, setState] = useState<State>(initialValue)

  const log = (opts && opts.log) || false

  useEffect(() => {
    const next$ = msg$.pipe(
      tap(msg => log && console.log("Event:", msg)),
      withLatestFrom(state$),
      map(([msg, state]) => updateFunc(state, msg)),
      tap(next => log && console.log("Update returned:", next)),
      share()
    )

    next$
      .pipe(
        map(({ effect }) => effect),
        filter(isEffect),
        mergeMap((effect: Effect<Event>) =>
          observableFromEffectResult(effect.run())
        )
      )
      .subscribe(msg$)

    next$.pipe(map(next => next.state)).subscribe(state$)

    const stateSubscription = state$
      .pipe(distinctUntilChanged())
      .subscribe(newState => {
        setState(newState)
      })

    // Prime the initials
    initialEffect &&
      observableFromEffectResult(initialEffect.run()).subscribe(m =>
        msg$.next(m)
      )
    state$.next(initialValue)

    return () => {
      stateSubscription.unsubscribe()
    }
    // eslint-disable-next-line
  }, [])

  const dispatch: Dispatch<Event> = useCallback(
    (msg: Event) => {
      msg$.next(msg)
    },
    [msg$]
  )

  return [state, dispatch]
}

// Commands
// --------

// HTTP get
type HttpGetOpts = {
  uri: string
}

type HttpGetResult = {
  data: string
}

export const httpGet = <M>(
  opts: HttpGetOpts,
  msgCreator: (r: HttpGetResult) => M
): Effect<M> =>
  makeEffect("http.get", () =>
    ajax(opts.uri).pipe(
      delay(1000), // For testing purposes
      map(res => msgCreator({ data: res.response }))
    )
  )

// Timeout
type TimeoutOpts = { duration: number }
export const timeout = <M>(duration: number, msgCreator: () => M): Effect<M> =>
  makeEffect("timeout", () => timer(duration).pipe(map(() => msgCreator())), {
    duration
  })
