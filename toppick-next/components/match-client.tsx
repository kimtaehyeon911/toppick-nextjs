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
    catch { toast('!', 'Could not save pick - check connection') }
  }

  const post = async (match: Match, body: string) => {
    try {
      await addPost(match.id, `${match.a.name} vs ${match.b.name}`, match.sport, body)
      setPosts(prev => [{ id: Date.now(), matchId: match.id, author: 'you', starIn: [...myStars], upvotes: 1, body }, ...prev])
      toast('\u2713', t('toast.posted', 'Reasoning posted'))
    } catch { toast('!', 'Pick this match first to post') }
  }

  const share = async () => {
    const url = `https://jointoppick.com/match/${m.id}`
    const title = `${m.a.name} vs ${m.b.name} prediction on Top Pick`
    const text = `Who wins? ${m.a.name} vs ${m.b.name}. Cast your free pick and see the crowd consensus.`
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast('\u2713', 'Link copied to clipboard')
      }
    } catch {}
  }

  return (
    <div className="wrap">
      <div className="match-share-bar">
        <button className="share-btn" onClick={share}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
          </svg>
          {t('share.match', 'Share this match')}
        </button>
      </div>
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