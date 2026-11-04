package events

import "encoding/json"

type GatewayOpcode int

const (
	OpDispatch                      GatewayOpcode = 0
	OpHeartbeat                     GatewayOpcode = 1
	OpIdentify                      GatewayOpcode = 2
	OpPresenceUpdate                GatewayOpcode = 3
	OpVoiceStateUpdate              GatewayOpcode = 4
	OpVoiceServerPing               GatewayOpcode = 5
	OpResume                        GatewayOpcode = 6
	OpReconnect                     GatewayOpcode = 7
	OpRequestGuildMembers           GatewayOpcode = 8
	OpInvalidSession                GatewayOpcode = 9
	OpHello                         GatewayOpcode = 10
	OpHeartbeatACK                  GatewayOpcode = 11
	OpCallConnect                   GatewayOpcode = 13
	OpGuildSubscriptions            GatewayOpcode = 14
	OpLobbyConnect                  GatewayOpcode = 15
	OpLobbyDisconnect               GatewayOpcode = 16
	OpLobbyVoiceStatesUpdate        GatewayOpcode = 17
	OpStreamCreate                  GatewayOpcode = 18
	OpStreamDelete                  GatewayOpcode = 19
	OpStreamWatch                   GatewayOpcode = 20
	OpStreamPing                    GatewayOpcode = 21
	OpStreamSetPaused               GatewayOpcode = 22
	OpRequestGuildAppCommands       GatewayOpcode = 24
	OpEmbeddedActivityLaunch        GatewayOpcode = 25
	OpEmbeddedActivityClose         GatewayOpcode = 26
	OpEmbeddedActivityUpdate        GatewayOpcode = 27
	OpRequestForumUnreads           GatewayOpcode = 28
	OpRemoteCommand                 GatewayOpcode = 29
	OpGetDeletedEntityIDs           GatewayOpcode = 30
	OpRequestSoundboardSounds       GatewayOpcode = 31
	OpSpeedTestCreate               GatewayOpcode = 32
	OpSpeedTestDelete               GatewayOpcode = 33
	OpRequestLastMessages           GatewayOpcode = 34
	OpSearchRecentMembers           GatewayOpcode = 35
	OpRequestChannelStatuses        GatewayOpcode = 36
	OpGuildSubscriptionsBulk        GatewayOpcode = 37
	OpGuildChannelsResync           GatewayOpcode = 38
	OpRequestChannelMemberCount     GatewayOpcode = 39
)

type VoiceOpcode int

const (
	VoiceOpIdentify                VoiceOpcode = 0
	VoiceOpSelectProtocol          VoiceOpcode = 1
	VoiceOpReady                   VoiceOpcode = 2
	VoiceOpHeartbeat               VoiceOpcode = 3
	VoiceOpSelectProtocolAck       VoiceOpcode = 4
	VoiceOpSpeaking                VoiceOpcode = 5
	VoiceOpHeartbeatAck            VoiceOpcode = 6
	VoiceOpResume                  VoiceOpcode = 7
	VoiceOpHello                   VoiceOpcode = 8
	VoiceOpResumed                 VoiceOpcode = 9
	VoiceOpClientsConnect          VoiceOpcode = 11
	VoiceOpVideo                   VoiceOpcode = 12
	VoiceOpClientDisconnect        VoiceOpcode = 13
	VoiceOpSessionUpdate           VoiceOpcode = 14
	VoiceOpMediaSinkWants          VoiceOpcode = 15
	VoiceOpVoiceBackendVersion     VoiceOpcode = 16
	VoiceOpChannelOptionsUpdate    VoiceOpcode = 17
	VoiceOpFlags                   VoiceOpcode = 18
	VoiceOpSpeedTest               VoiceOpcode = 19
	VoiceOpPlatform                VoiceOpcode = 20
	VoiceOpDavePrepareTransition   VoiceOpcode = 21
	VoiceOpDaveExecuteTransition   VoiceOpcode = 22
	VoiceOpDaveTransitionReady     VoiceOpcode = 23
	VoiceOpDavePrepareEpoch        VoiceOpcode = 24
	VoiceOpMLSInvalidCommitWelcome VoiceOpcode = 31
)

const (
	EventReady              = "READY"
	EventResumed            = "RESUMED"
	EventMessageCreate      = "MESSAGE_CREATE"
	EventVoiceStateUpdate   = "VOICE_STATE_UPDATE"
	EventVoiceServerUpdate  = "VOICE_SERVER_UPDATE"
	EventStreamCreate       = "STREAM_CREATE"
	EventStreamServerUpdate = "STREAM_SERVER_UPDATE"
	EventStreamDelete       = "STREAM_DELETE"
	EventGuildCreate        = "GUILD_CREATE"
)

type GatewayPayload struct {
	Op GatewayOpcode   `json:"op"`
	D  json.RawMessage `json:"d,omitempty"`
	S  *int64          `json:"s,omitempty"`
	T  string          `json:"t,omitempty"`
}

type OutboundGatewayPayload struct {
	Op GatewayOpcode `json:"op"`
	D  interface{}   `json:"d"`
}

type HelloData struct {
	HeartbeatInterval int `json:"heartbeat_interval"`
}

type UserPayload struct {
	ID            string  `json:"id"`
	Username      string  `json:"username"`
	GlobalName    string  `json:"global_name,omitempty"`
	Discriminator string  `json:"discriminator"`
	Avatar        *string `json:"avatar"`
	Bot           bool    `json:"bot"`
}

func (u UserPayload) Tag() string {
	if u.Discriminator != "" && u.Discriminator != "0" && u.Discriminator != "0000" {
		return u.Username + "#" + u.Discriminator
	}
	return u.Username
}

type ReadyData struct {
	V                int                  `json:"v"`
	User             UserPayload          `json:"user"`
	SessionID        string               `json:"session_id"`
	ResumeGatewayURL string               `json:"resume_gateway_url"`
	Guilds           []GuildCreatePayload `json:"guilds,omitempty"`
}

type GuildCreatePayload struct {
	ID          string            `json:"id"`
	VoiceStates []VoiceStateEvent `json:"voice_states,omitempty"`
}

type MessageCreateEvent struct {
	ID        string      `json:"id"`
	ChannelID string      `json:"channel_id"`
	GuildID   string      `json:"guild_id,omitempty"`
	Content   string      `json:"content"`
	Timestamp string      `json:"timestamp"`
	Author    UserPayload `json:"author"`
}

type MessageCreateData = MessageCreateEvent

type VoiceStateEvent struct {
	GuildID    string  `json:"guild_id,omitempty"`
	ChannelID  *string `json:"channel_id"`
	UserID     string  `json:"user_id"`
	SessionID  string  `json:"session_id"`
	SelfDeaf   bool    `json:"self_deaf"`
	SelfMute   bool    `json:"self_mute"`
	SelfStream bool    `json:"self_stream"`
	SelfVideo  bool    `json:"self_video"`
}

type VoiceState = VoiceStateEvent

type VoiceServerUpdateEvent struct {
	Token     string  `json:"token"`
	GuildID   string  `json:"guild_id"`
	ChannelID *string `json:"channel_id,omitempty"`
	Endpoint  string  `json:"endpoint"`
}

type StreamCreateEvent struct {
	StreamKey   string   `json:"stream_key"`
	RTCServerID string   `json:"rtc_server_id"`
	Region      string   `json:"region"`
	ViewerIDs   []string `json:"viewer_ids"`
	Paused      bool     `json:"paused"`
}

type StreamServerUpdateEvent struct {
	StreamKey string `json:"stream_key"`
	GuildID   string `json:"guild_id,omitempty"`
	Endpoint  string `json:"endpoint"`
	Token     string `json:"token"`
}

type StreamDeleteEvent struct {
	StreamKey   string `json:"stream_key"`
	Reason      string `json:"reason"`
	Unavailable bool   `json:"unavailable"`
}

type ActivityPayload struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type PresenceUpdatePayload struct {
	Since      *int64            `json:"since"`
	Activities []ActivityPayload `json:"activities"`
	Status     string            `json:"status"`
	AFK        bool              `json:"afk"`
}
