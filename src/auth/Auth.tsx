import type { ReactNode } from "react"
import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react"

// Clerk publishable key comes from the env (Vite exposes VITE_-prefixed vars).
// If it's missing (e.g. a fresh clone with no .env), auth is simply disabled so
// the game still runs — no crash, no blank screen.
const PUB_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
export const clerkEnabled = Boolean(PUB_KEY)

/** Wraps the app in ClerkProvider only when a key is configured. */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkEnabled) return <>{children}</>
  return (
    <ClerkProvider publishableKey={PUB_KEY!} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}

/** Sign-in / sign-up buttons when signed out; the account menu when signed in. */
export function AuthButtons() {
  if (!clerkEnabled) return null
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="auth-btn" title="Sign in">sign in</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="auth-btn primary" title="Create an account">sign up</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: { width: 34, height: 34 } } }}
        />
      </SignedIn>
    </>
  )
}
