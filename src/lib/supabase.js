import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const CATEGORY_PREFIX = {
  'Phase 0: Control': 'O',
  'Phase 1: Hook': 'H',
  'Phase 2: Body': 'B',
  'Phase 3: CTA': 'C',
  'Phase 4: Final': 'F',
  'Phase 5: Scale': 'S',
  '기타': 'X',
}

export function getCategoryPrefix(category) {
  return CATEGORY_PREFIX[category] || 'X'
}

// ---- Hypotheses ----

export async function fetchHypotheses() {
  const { data, error } = await supabase
    .from('hypotheses')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getNextHypothesisId(category) {
  const prefix = getCategoryPrefix(category)
  const { data, error } = await supabase
    .from('hypotheses')
    .select('id')
    .like('id', `${prefix}-%`)
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) return `${prefix}-01`
  const lastNum = parseInt(data[0].id.split('-')[1], 10)
  return `${prefix}-${String(lastNum + 1).padStart(2, '0')}`
}

export async function createHypothesis(hypothesis) {
  const { data, error } = await supabase
    .from('hypotheses')
    .insert(hypothesis)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHypothesis(id, updates) {
  const { data, error } = await supabase
    .from('hypotheses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHypothesis(id) {
  const { error } = await supabase.from('hypotheses').delete().eq('id', id)
  if (error) throw error
}

// ---- Ad Performance ----

export async function fetchAdPerformance(filters = {}) {
  let query = supabase
    .from('ad_performance')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.hypothesis_id) query = query.eq('hypothesis_id', filters.hypothesis_id)
  if (filters.adset_name) query = query.eq('adset_name', filters.adset_name)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function insertAdPerformance(rows) {
  const { data, error } = await supabase
    .from('ad_performance')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

// ---- Adset Performance ----

export async function fetchAdsetPerformance() {
  const { data, error } = await supabase
    .from('adset_performance')
    .select('*, hypotheses(title, category)')
    .order('upload_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertAdsetPerformance(rows) {
  const { data, error } = await supabase
    .from('adset_performance')
    .insert(rows)
    .select()
  if (error) throw error
  return data
}

export async function deleteAdsetPerformance(id) {
  const { error } = await supabase.from('adset_performance').delete().eq('id', id)
  if (error) throw error
}

export async function updateAdsetPerformance(id, updates) {
  const { data, error } = await supabase
    .from('adset_performance')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdPerformance(id) {
  const { error } = await supabase.from('ad_performance').delete().eq('id', id)
  if (error) throw error
}

export async function updateAdPerformance(id, updates) {
  const { data, error } = await supabase
    .from('ad_performance')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdsByAdset(adsetName) {
  const { error } = await supabase.from('ad_performance').delete().eq('adset_name', adsetName)
  if (error) throw error
}
