import { ImageResponse } from 'next/og'
import { getMatch } from '@/lib/data'

export const runtime = 'edge'
export const alt = 'Match prediction on Top Pick'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPORT_LABEL: Record<string, string> = {
  soccer: 'SOCCER', basketball: 'BASKETBALL', baseball: 'BASEBALL',
  ufc: 'UFC', football: 'FOOTBALL',
}

export default async function Image({ params }: { params: { id: string } }) {
  const m = await getMatch(Number(params.id))

  const teamA = m?.a?.name ?? 'Team A'
  const teamB = m?.b?.name ?? 'Team B'
  const abbrA = m?.a?.abbr ?? 'A'
  const abbrB = m?.b?.abbr ?? 'B'
  const colorA = m?.a?.color ?? '#ff8a00'
  const colorB = m?.b?.color ?? '#3b82f6'
  const sport = m?.sport ? (SPORT_LABEL[m.sport] ?? m.sport.toUpperCase()) : 'PREDICTION'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: '#0a0e14', color: '#fff', fontFamily: 'sans-serif',
          position: 'relative', padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#ff8a00' }} />
          <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.5px' }}>Top Pick</div>
          <div style={{
            marginLeft: '14px', fontSize: '18px', fontWeight: 700, color: '#8895a7',
            letterSpacing: '2px',
          }}>{sport}</div>
        </div>

        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '400px' }}>
            <div style={{
              width: '150px', height: '150px', borderRadius: '24px', background: colorA,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '60px', fontWeight: 800,
            }}>{abbrA}</div>
            <div style={{ marginTop: '24px', fontSize: '40px', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{teamA}</div>
          </div>

          <div style={{ fontSize: '48px', fontWeight: 800, color: '#8895a7' }}>VS</div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '400px' }}>
            <div style={{
              width: '150px', height: '150px', borderRadius: '24px', background: colorB,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '60px', fontWeight: 800,
            }}>{abbrB}</div>
            <div style={{ marginTop: '24px', fontSize: '40px', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{teamB}</div>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', fontSize: '26px', color: '#8895a7', fontWeight: 600,
        }}>
          Cast your free pick. See the crowd consensus.
        </div>

        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: '100%', height: '8px',
          background: 'linear-gradient(90deg, ' + colorA + ' 0%, #ff8a00 50%, ' + colorB + ' 100%)',
        }} />
      </div>
    ),
    { ...size }
  )
}