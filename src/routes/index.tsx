import { createFileRoute } from '@tanstack/react-router'
import { PartyRoom } from '@/components/party/PartyRoom'

export const Route = createFileRoute('/')({
  component: PartyPage,
})

function PartyPage() {
  return (
    <main className="mx-auto w-full max-w-7xl">
      <PartyRoom />
    </main>
  )
}
