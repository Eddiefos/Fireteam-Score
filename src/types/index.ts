export type Profile = {
  id: string
  username: string
  display_name: string
  initials: string
  avatar_color: string
  created_at: string
}

export type CourseHole = {
  hole_number: number
  par: number
  distance_m: number | null
}

export type Course = {
  id: string
  name: string
  location: string | null
  holes: number
  par_total: number | null
  pars: number[]
  source: 'pdga' | 'user'
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type Round = {
  id: string
  course_id: string
  course_name: string
  pars: number[]
  status: 'active' | 'finished' | 'abandoned'
  holes_played: number
  created_by: string
  started_at: string
  finished_at: string | null
  players: RoundPlayer[]
  scores: Record<string, (number | null)[]>
}

export type RoundPlayer = {
  id: string
  name: string
  color: string
}

export type Score = {
  id: string
  round_id: string
  user_id: string
  hole_number: number
  strokes: number
  created_at: string
}

export type PendingScore = {
  round_id: string
  user_id: string
  hole_number: number
  strokes: number
  timestamp: number
}
