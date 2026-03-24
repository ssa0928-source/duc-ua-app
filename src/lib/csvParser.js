import Papa from 'papaparse'

// AppsFlyer CSV 컬럼 매핑
const COL = {
  adset: 'Adset',
  ad: 'Ad',
  ipm: 'IPM appsflyer',
  impressions: 'Impressions',
  clicks: 'Clicks',
  installs: 'Installs appsflyer',
  cost: 'Cost',
  ecpi: 'eCPI appsflyer',
  active_users: 'Active users activity days appsflyer',
  revenue: 'Revenue activity days appsflyer',
  roas: 'ROAS activity days appsflyer',
  af_login: 'Unique users activity days appsflyer af_login',
  af_tutorial_completion: 'Unique users activity days appsflyer af_tutorial_completion',
}

// 소재명 파싱: DUC_{날짜}_{가설ID}_{컨셉}_UA_...
export function parseAssetName(adName) {
  const parts = adName.split('_')
  if (!parts[2]) return null

  const hypothesisRaw = parts[2]
  const match = hypothesisRaw.match(/^([A-Z])(\d+)$/)
  if (!match) return null

  const prefix = match[1]
  const hypothesisId = `${prefix}-${match[2].padStart(2, '0')}`

  // UA_VID / UA_IMG 형식 우선, 없으면 전체 토큰에서 VID/IMG 탐색
  const uaIdx = parts.indexOf('UA')
  let mediaRaw = uaIdx !== -1 ? parts[uaIdx + 1] : null
  if (mediaRaw !== 'VID' && mediaRaw !== 'IMG') {
    mediaRaw = parts.find(p => p === 'VID' || p === 'IMG') || null
  }
  const mediaType = mediaRaw === 'VID' ? '비디오' : mediaRaw === 'IMG' ? '이미지' : null

  // 해상도: WxH 패턴 (1080x1920, 1920x1080 등)
  const RESOLUTIONS = ['1080x1920', '1920x1080', '1080x1080', '1080x1350']
  const resolution = parts.find(p => RESOLUTIONS.includes(p)) || parts.find(p => /^\d+[xX]\d+$/.test(p)) || null

  return { hypothesisId, mediaType, resolution }
}

function safeNum(val) {
  if (val === undefined || val === null || val === '' || val === '-') return 0
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data

        const parsed = rows
          .filter(row => row[COL.ad] && String(row[COL.ad]).trim())
          .map(row => {
            const adName = String(row[COL.ad] || '').trim()
            const adsetName = String(row[COL.adset] || '').trim()

            const impressions = safeNum(row[COL.impressions])
            const installs = safeNum(row[COL.installs])
            let ipm = safeNum(row[COL.ipm])
            if (!ipm && impressions > 0) {
              ipm = parseFloat(((installs / impressions) * 1000).toFixed(2))
            }

            const parsed = parseAssetName(adName)

            return {
              adset_name: adsetName,
              ad_name: adName,
              hypothesis_id: parsed?.hypothesisId || null,
              media_type: parsed?.mediaType || null,
              resolution: parsed?.resolution || null,
              ipm: parseFloat(ipm.toFixed(2)),
              impressions,
              clicks: safeNum(row[COL.clicks]),
              installs,
              cost: safeNum(row[COL.cost]),
              ecpi: safeNum(row[COL.ecpi]),
              active_users: safeNum(row[COL.active_users]),
              revenue: safeNum(row[COL.revenue]),
              roas: safeNum(row[COL.roas]),
              af_login: safeNum(row[COL.af_login]),
              af_tutorial_completion: safeNum(row[COL.af_tutorial_completion]),
              matchStatus: parsed
                ? 'matched'
                : 'general', // 파싱 성공했지만 가설 ID 없는 일반 소재
            }
          })

        resolve({ rows: parsed, headers })
      },
      error(err) {
        reject(err)
      },
    })
  })
}

// Ad Set 단위 집계
export function aggregateByAdset(rows) {
  const adsetMap = {}

  for (const row of rows) {
    const key = row.adset_name
    if (!adsetMap[key]) {
      adsetMap[key] = {
        adset_name: key,
        hypothesis_id: null,
        ads: [],
        total_impressions: 0,
        total_installs: 0,
        total_cost: 0,
        ecpis: [],
      }
    }
    const grp = adsetMap[key]
    grp.ads.push(row)
    grp.total_impressions += row.impressions
    grp.total_installs += row.installs
    grp.total_cost += row.cost
    if (row.ecpi) grp.ecpis.push(row.ecpi)

    if (!grp.hypothesis_id && row.hypothesis_id) {
      grp.hypothesis_id = row.hypothesis_id
    }
  }

  return Object.values(adsetMap).map(grp => {
    const avgIpm =
      grp.ads.length > 0
        ? parseFloat((grp.ads.reduce((a, b) => a + b.ipm, 0) / grp.ads.length).toFixed(2))
        : 0
    const avgEcpi =
      grp.ecpis.length > 0
        ? parseFloat((grp.ecpis.reduce((a, b) => a + b, 0) / grp.ecpis.length).toFixed(2))
        : 0

    return {
      ...grp,
      avg_ipm: avgIpm,
      avg_ecpi: avgEcpi,
      ad_count: grp.ads.length,
    }
  })
}
