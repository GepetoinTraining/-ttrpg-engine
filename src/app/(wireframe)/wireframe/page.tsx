import DMHelperApp from '@/components/design/DMHelperApp'

// /wireframe — the original 51-surface design wireframe.
// Hash routing inside (#auth, #chargen, etc.) keeps working.
// The real app lives at / (landing) → /dm/* (real DM surfaces).

export default function WireframePage() {
  return <DMHelperApp />
}
