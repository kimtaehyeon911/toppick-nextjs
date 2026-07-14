'use client'
import { useApp } from '@/components/providers'
import { ProfileView } from '@/components/views'
import { AccountBanner } from '@/components/account-banner'
import { MyPicks } from '@/components/my-picks'

export default function ProfilePage() {
  const { t, myStars, toggleStar } = useApp()
  return (
    <div className="wrap">
      <AccountBanner />
      <MyPicks />
      <ProfileView myStars={myStars} onToggleStar={toggleStar} t={t} />
    </div>
  )
}