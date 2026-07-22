import { useEffect, useRef, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, googleProvider, firebaseEnabled } from "../firebase"
import { PixelSprite } from "../three/Character"
import { useGame, type CharacterLook } from "../game/store"

function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])
  return user
}

interface CloudDoc {
  coins?: number
  ownedSkins?: string[]
  character?: CharacterLook
}

/** On sign-in: merge cloud + local progress, then keep the cloud in sync.
 *  On sign-out: wipe back to a guest profile so the account's balance doesn't
 *  linger (and can't leak into the next account's merge). */
function useCloudSync(user: User | null) {
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (!user) {
      if (wasSignedIn.current) useGame.getState().resetProgress()
      wasSignedIn.current = false
      return
    }
    wasSignedIn.current = true
    if (!db) return
    let cancelled = false
    const ref = doc(db, "players", user.uid)

    // load, merge (max coins, union owned, prefer cloud look), write back
    ;(async () => {
      const snap = await getDoc(ref).catch(() => null)
      if (cancelled || !snap) return
      const s = useGame.getState()
      let coins = s.coins
      let ownedSkins = s.ownedSkins
      let character = s.character
      if (snap.exists()) {
        const d = snap.data() as CloudDoc
        coins = Math.max(coins, d.coins ?? 0)
        ownedSkins = Array.from(new Set([...(d.ownedSkins ?? []), ...ownedSkins]))
        if (d.character) character = d.character
      }
      useGame.getState().applyCloud({ coins, ownedSkins, character })
      void setDoc(ref, { coins, ownedSkins, character, updatedAt: serverTimestamp() }, { merge: true })
    })()

    // push local changes (coins / owned / equipped look) up, debounced
    const keyOf = () => {
      const s = useGame.getState()
      return `${s.coins}|${s.character.skin}|${s.character.fur}|${s.character.accent}|${[...s.ownedSkins].sort().join(",")}`
    }
    let last = keyOf()
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useGame.subscribe(() => {
      const k = keyOf()
      if (k === last) return
      last = k
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const s = useGame.getState()
        void setDoc(ref, { coins: s.coins, ownedSkins: s.ownedSkins, character: s.character, updatedAt: serverTimestamp() }, { merge: true })
      }, 800)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [user])
}

/** Google sign-in / account chip. Renders nothing if Firebase isn't configured. */
export function AuthButtons() {
  const user = useAuthUser()
  useCloudSync(user)
  const character = useGame((s) => s.character)

  // one-second cutscene when you first sign in (null -> user): welcome ring + climber peek
  const [celebrate, setCelebrate] = useState(false)
  const prevUser = useRef<User | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    if (!prevUser.current && user) {
      setCelebrate(true)
      t = setTimeout(() => setCelebrate(false), 1150)
    }
    prevUser.current = user
    return () => clearTimeout(t)
  }, [user])

  if (!firebaseEnabled || !auth) return null

  if (!user) {
    return (
      <button
        className="auth-btn primary tactile"
        onClick={() => void signInWithPopup(auth!, googleProvider)}
        title="Sign in with Google — saves your coins & skins across devices"
      >
        <span className="auth-g" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="16" height="16">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        </span>
        <span>sign in</span>
      </button>
    )
  }

  const first = user.displayName?.split(" ")[0] ?? "you"
  const welcome = celebrate ? " welcome" : ""
  return (
    <div className="auth-user" title={user.email ?? undefined}>
      {celebrate && <PixelSprite look={character} className="auth-peek" />}
      {user.photoURL ? (
        <img className={`auth-avatar${welcome}`} src={user.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className={`auth-avatar auth-avatar-fallback${welcome}`}>{first[0]?.toUpperCase()}</span>
      )}
      <button className="auth-btn auth-out tactile" onClick={() => void signOut(auth!)} title="Sign out">out</button>
    </div>
  )
}
