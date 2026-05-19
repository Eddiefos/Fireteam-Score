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
  lat: number | null
  lng: number | null
  holes: number
  par_total: number | null
  pars: number[]
  source: 'pdga' | 'user'
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type RoundPlayer = {
  id: string           // round_players.id — used as score key
  roundId: string
  userId: string | null
  guestName: string | null
  displayName: string
  initials: string
  color: string
  isGuest: boolean
}

export type NewRoundPlayer = {
  userId?: string
  guestName?: string
  displayName: string
  initials: string
  color: string
  isGuest: boolean
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

export type Score = {
  id: string
  round_id: string
  round_player_id: string | null
  user_id: string | null
  hole_number: number
  strokes: number
  created_at: string
}

export type PendingScore = {
  round_id: string
  round_player_id: string | null
  user_id: string | null
  hole_number: number
  strokes: number
  timestamp: number
}

export type Friend = {
  id: string           // friends.id
  userId: string       // the other person's profile id
  displayName: string
  username: string
  initials: string
  avatarColor: string
  roundsTogether: number
  avgVsPar: number | null
}

export type FriendRequest = {
  id: string
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'declined'
  profile: Profile
  createdAt: string
}

export type Fireteam = {
  id: string
  name: string
  created_by: string | null
  invite_code: string
  created_at: string
}

export type FireteamMember = {
  fireteam_id: string
  user_id: string
  joined_at: string
}

export type FireteamInvite = {
  id: string
  fireteam_id: string
  fireteam_name: string
  inviter_id: string
  inviter_name: string
  invitee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export type FireteamLeaderboardEntry = {
  profile: Profile
  wins: number
  avgVsPar: number
  roundsPlayed: number
}

export type HeadToHead = {
  wins: number
  losses: number
  streak: number
  streakType: 'win' | 'loss' | null
}

export type SavedCourse = {
  user_id: string
  course_id: string
  saved_at: string
}
