'use client'
import { useApp } from '@/components/providers'
import { ProfileView } from '@/components/views'
import { AccountBanner } from '@/components/account-banner'

export default function ProfilePage() {
  const { t, myStars, toggleStar } = useApp()
  return (
    <div className="wrap">
      <AccountBanner />
      <ProfileView myStars={myStars} onToggleStar={toggleStar} t={t} />
    </div>
  )
}