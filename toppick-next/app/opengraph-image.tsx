import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Top Pick - free sports prediction skill market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0a0e14', color: '#fff', fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#ff8a00' }} />
          <div style={{ fontSize: '84px', fontWeight: 800, letterSpacing: '-2px' }}>Top Pick</div>
        </div>
        <div style={{ marginTop: '28px', fontSize: '34px', color: '#8895a7', fontWeight: 600, textAlign: 'center', maxWidth: '820px', lineHeight: 1.3 }}>
          Predict match winners for free. Beat the crowd. Climb the skill leaderboard.
        </div>
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: '100%', height: '8px',
          background: 'linear-gradient(90deg, #ff8a00 0%, #3b82f6 100%)',
        }} />
      </div>
    ),
    { ...size }
  )
}