const ADJECTIVES = [
  'Swift',
  'Cosmic',
  'Silent',
  'Binary',
  'Neon',
  'Quantum',
  'Astral',
  'Turbo',
  'Pixel',
  'Cyber',
  'Stealth',
  'Atomic',
  'Hyper',
  'Sonic',
  'Fuzzy',
  'Blazing',
  'Frozen',
  'Shadow',
  'Golden',
  'Crystal',
  'Electric',
  'Midnight',
  'Rogue',
  'Zen',
  'Nova',
]

const NOUNS = [
  'Octocat',
  'Commit',
  'Branch',
  'Merge',
  'Deploy',
  'Pipeline',
  'Socket',
  'Packet',
  'Daemon',
  'Token',
  'Kernel',
  'Widget',
  'Gopher',
  'Ferris',
  'Crab',
  'Panda',
  'Phoenix',
  'Dragon',
  'Falcon',
  'Wolf',
  'Fox',
  'Shark',
  'Squid',
  'Mantis',
  'Cobra',
]

export function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}${noun}${num}`
}
