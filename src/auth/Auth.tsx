import { useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, googleProvider, firebaseEnabled } from "../firebase"
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

/** On sign-in: merge cloud + local progress, then keep the cloud in sync. */
function useCloudSync(user: User | null) {
  useEffect(() => {
    if (!user || !db) return
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

  if (!firebaseEnabled || !auth) return null

  if (!user) {
    return (
      <button
        className="auth-btn primary"
        onClick={() => void signInWithPopup(auth!, googleProvider)}
        title="Sign in with Google — saves your coins & skins across devices"
      >
        sign in
      </button>
    )
  }

  const first = user.displayName?.split(" ")[0] ?? "you"
  return (
    <div className="auth-user" title={user.email ?? undefined}>
      {user.photoURL ? (
        <img className="auth-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="auth-avatar auth-avatar-fallback">{first[0]?.toUpperCase()}</span>
      )}
      <button className="auth-btn" onClick={() => void signOut(auth!)} title="Sign out">out</button>
    </div>
  )
}
