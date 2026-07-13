'use client'
import { useApp } from '@/components/providers'
import { ProfileView } from '@/components/views'

export default function ProfilePage() {
  const { t, myStars, toggleStar } = useApp()
  return (
    <div className="wrap">
      <ProfileView myStars={myStars} onToggleStar={toggleStar} t={t} />
    </div>
  )
}
