'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Match, Post, Side } from '@/lib/types'
import { mockPosts } from '@/lib/mock'
import { hasBackend, listMatches, castPick, onConsensusChange, addPost, listPosts } from '@/lib/api'
import { useApp } from './providers'
import { MatchDetail } from './views'

export function MatchClient({ initial }: { initial: Match }) {
  const { t, canView, openPanels, togglePanel, requestUnlock, myStars, toast } = useApp()
  const router = useRouter()
  const [m, setM] = useState<Match>(initial)
  const [posts, setPosts] = useState<Post[]>(mockPosts.filter(p => p.matchId === initial.id))

  const refresh = useCallback(() => {
    listMatches().then(all => { const f = all.find(x => x.id === initial.id); if (f) setM(f) })
  }, [initial.id])

  useEffect(() => {
    if (hasBackend) { refresh(); listPosts(initial.id).then(p => p.length && setPosts(p)) }
    return onConsensusChange(refresh)
  }, [refresh, initial.id])

  const vote = async (id: number, side: Side) => {
    try { await castPick(id, side); hasBackend ? refresh() : setM(prev => applyLocalVote(prev, side)) }
    catch { toast('!', 'Could not save pick — check connection') }
  }

  const post = async (match: Match, body: string) => {
    try {
      await addPost(match.id, `${match.a.name} vs ${match.b.name}`, match.sport, body)
      setPosts(prev => [{ id: Date.now(), matchId: match.id, author: 'you', starIn: [...myStars], upvotes: 1, body }, ...prev])
      toast('✓', t('toast.posted', 'Reasoning posted'))
    } catch { toast('!', 'Pick this match first to post') }
  }

  return (
    <div className="wrap">
      <MatchDetail m={m} viewable={canView(m)} open={canView(m) && openPanels.has(m.id)}
        posts={posts} myStars={myStars}
        onVote={vote} onStar={() => (canView(m) ? togglePanel(m.id) : requestUnlock(m))}
        onBack={() => router.push('/')} onPost={post} t={t} />
    </div>
  )
}

function applyLocalVote(m: Match, side: Side): Match {
  if (m.myPick === side) return m
  const n = { ...m }
  if (n.myPick === 'a') n.votesA--
  if (n.myPick === 'b') n.votesB--
  side === 'a' ? n.votesA++ : n.votesB++
  n.myPick = side
  return n
}
