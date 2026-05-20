export type Profile = {
  id: string
  username: string
  display_name: string
  initials: string
  avatar_color: string
  is_admin: boolean
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
  source: 'official' | 'user'
  is_public: boolean
  created_by: string | null
  created_at: string
  course_holes?: CourseHole[]
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

export interface WeatherData {
  temperature: number;      // Celsius
  windSpeed: number;        // m/s
  windDirection: number;    // degrees 0–360
  symbolCode: string;       // Met.no symbol_code e.g. "clearsky_day"
  fetchedAt: number;        // Date.now() timestamp
}

export interface CourseSubmission {
  id: string;
  submitted_by: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  holes: number;
  holes_detail: Array<{ hole_number: number; par: number }> | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
