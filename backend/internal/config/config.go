package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type SupportedVideoCodec string
type H26xPreset string

const (
	VideoCodecH264 SupportedVideoCodec = "H264"
	VideoCodecH265 SupportedVideoCodec = "H265"
	VideoCodecVP8  SupportedVideoCodec = "VP8"
	VideoCodecVP9  SupportedVideoCodec = "VP9"
	VideoCodecAV1  SupportedVideoCodec = "AV1"

	PresetUltrafast H26xPreset = "ultrafast"
	PresetSuperfast H26xPreset = "superfast"
	PresetVeryfast  H26xPreset = "veryfast"
	PresetFaster    H26xPreset = "faster"
	PresetFast      H26xPreset = "fast"
	PresetMedium    H26xPreset = "medium"
	PresetSlow      H26xPreset = "slow"
	PresetSlower    H26xPreset = "slower"
	PresetVeryslow  H26xPreset = "veryslow"
)

var (
	ValidVideoCodecs = []string{"H264", "H265", "VP8", "VP9", "AV1"}
	ValidPresets     = []string{
		"ultrafast",
		"superfast",
		"veryfast",
		"faster",
		"fast",
		"medium",
		"slow",
		"slower",
		"veryslow",
	}
)

func ResolveWorkspaceRoot() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	base := filepath.Base(cwd)
	switch base {
	case "quest", "stream", "badge-farm", "backend":
		return filepath.Clean(filepath.Join(cwd, ".."))
	case "server", "bot", "spoofer":
		return filepath.Clean(filepath.Join(cwd, "..", "..", ".."))
	}
	if _, err := os.Stat(filepath.Join(cwd, "database")); err == nil {
		return cwd
	}
	parent := filepath.Clean(filepath.Join(cwd, ".."))
	if _, err := os.Stat(filepath.Join(parent, "database")); err == nil {
		return parent
	}
	grandParent := filepath.Clean(filepath.Join(cwd, "..", ".."))
	if _, err := os.Stat(filepath.Join(grandParent, "database")); err == nil {
		return grandParent
	}
	return cwd
}

func FindRootEnvFile() string {
	cwd, _ := os.Getwd()
	root := ResolveWorkspaceRoot()
	candidates := []string{
		filepath.Join(root, ".env"),
		filepath.Join(cwd, ".env"),
		filepath.Join(cwd, "..", ".env"),
		filepath.Join(cwd, "..", "..", ".env"),
	}
	for _, p := range candidates {
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			return p
		}
	}
	return filepath.Join(root, ".env")
}

func LoadEnv() {
	envPath := FindRootEnvFile()
	data, err := os.ReadFile(envPath)
	if err != nil {
		return
	}
	lines := strings.Split(string(data), "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(strings.TrimSuffix(rawLine, "\r"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}

func UpdateEnvFile(updates map[string]string) error {
	envPath := FindRootEnvFile()
	var content string
	if data, err := os.ReadFile(envPath); err == nil {
		content = string(data)
	}

	for key, val := range updates {
		re := regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(key) + `\s*=.*$`)
		replacement := fmt.Sprintf(`%s = "%s"`, key, val)
		if re.MatchString(content) {
			content = re.ReplaceAllString(content, replacement)
		} else {
			if content != "" && !strings.HasSuffix(content, "\n") {
				content += "\n"
			}
			content += replacement + "\n"
		}
		_ = os.Setenv(key, val)
	}

	return os.WriteFile(envPath, []byte(content), 0644)
}

func EnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func ParseVideoCodec(value interface{}) SupportedVideoCodec {
	if s, ok := value.(string); ok {
		normalized := strings.ToUpper(strings.TrimSpace(s))
		for _, c := range ValidVideoCodecs {
			if c == normalized {
				return SupportedVideoCodec(normalized)
			}
		}
	}
	return VideoCodecH264
}

func ParsePreset(value interface{}) H26xPreset {
	if s, ok := value.(string); ok {
		normalized := strings.ToLower(strings.TrimSpace(s))
		for _, p := range ValidPresets {
			if p == normalized {
				return H26xPreset(normalized)
			}
		}
	}
	return PresetUltrafast
}

func ParseBoolean(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "true") || strings.TrimSpace(v) == "1"
	case float64:
		return v != 0
	case int:
		return v != 0
	default:
		return false
	}
}

func ParseAdminIDs(value string) []string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return []string{}
	}
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		var parsed []interface{}
		if err := json.Unmarshal([]byte(trimmed), &parsed); err == nil {
			out := make([]string, 0, len(parsed))
			for _, item := range parsed {
				s := strings.TrimSpace(fmt.Sprintf("%v", item))
				if s != "" {
					out = append(out, s)
				}
			}
			return out
		}
	}
	if strings.Contains(trimmed, ",") {
		parts := strings.Split(trimmed, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			s := strings.TrimSpace(p)
			if s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return []string{trimmed}
}

type StreamConfig struct {
	mu sync.RWMutex

	Token        string   `json:"token"`
	Prefix       string   `json:"prefix"`
	GuildID      string   `json:"guildId"`
	CmdChannelID   string   `json:"cmdChannelId"`
	VideoChannelID string   `json:"videoChannelId"`
	VideoChanID    string   `json:"-"`
	AdminIDs       []string `json:"adminIds"`

	VideosDir       string `json:"videosDir"`
	PreviewCacheDir string `json:"previewCacheDir"`

	YtdlpCookiesPath string `json:"ytdlpCookiesPath"`

	RespectVideoParams          bool   `json:"respect_video_params"`
	BitrateOverride             bool   `json:"bitrateOverride"`
	Width                       int    `json:"width"`
	Height                      int    `json:"height"`
	FPS                         int    `json:"fps"`
	BitrateKbps                 int    `json:"bitrateKbps"`
	MaxBitrateKbps              int    `json:"maxBitrateKbps"`
	MaxWidth                    int    `json:"maxWidth"`
	MaxHeight                   int    `json:"maxHeight"`
	HardwareAcceleratedDecoding bool                `json:"hardwareAcceleratedDecoding"`
	H26xPreset                  H26xPreset          `json:"h26xPreset"`
	VideoCodec                  SupportedVideoCodec `json:"videoCodec"`

	ViewerToken     string `json:"viewerToken"`
	ViewerAutoWatch bool   `json:"viewerAutoWatch"`
	StreamLoop      bool   `json:"streamLoop"`

	ServerEnabled  bool   `json:"serverEnabled"`
	ServerPort     int    `json:"serverPort"`
	ServerUsername string `json:"serverUsername"`
	ServerPassword string `json:"serverPassword"`
}

type dbTokenSnapshot struct {
	Accounts []struct {
		Tokens struct {
			StreamMainToken   string `json:"streamMainToken"`
			StreamViewerToken string `json:"streamViewerToken"`
			StreamGuildID     string `json:"streamGuildId"`
			StreamChannelID   string `json:"streamChannelId"`
			Prefix            string `json:"prefix"`
			CommandChannelID  string `json:"commandChannelId"`
			AdminIDs          string `json:"adminIds"`
		} `json:"tokens"`
	} `json:"accounts"`
}

func loadStreamTokensFromDB() (mainTok, viewerTok, guildID, videoChanID, prefix, cmdChanID string, adminIDs []string) {
	root := ResolveWorkspaceRoot()
	dbFile := filepath.Join(root, "database", "commercial_db.json")
	data, err := os.ReadFile(dbFile)
	if err != nil {
		return
	}
	var snap dbTokenSnapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return
	}
	for _, acc := range snap.Accounts {
		if strings.TrimSpace(acc.Tokens.StreamMainToken) != "" || strings.TrimSpace(acc.Tokens.StreamViewerToken) != "" {
			mainTok = strings.TrimSpace(acc.Tokens.StreamMainToken)
			viewerTok = strings.TrimSpace(acc.Tokens.StreamViewerToken)
			guildID = strings.TrimSpace(acc.Tokens.StreamGuildID)
			videoChanID = strings.TrimSpace(acc.Tokens.StreamChannelID)
			prefix = strings.TrimSpace(acc.Tokens.Prefix)
			cmdChanID = strings.TrimSpace(acc.Tokens.CommandChannelID)
			if strings.TrimSpace(acc.Tokens.AdminIDs) != "" {
				adminIDs = ParseAdminIDs(acc.Tokens.AdminIDs)
			}
			return
		}
	}
	return
}

func NewStreamConfig() *StreamConfig {
	LoadEnv()
	root := ResolveWorkspaceRoot()
	mainTok, viewerTok, dbGuildID, dbVideoChanID, dbPrefix, dbCmdChanID, dbAdminIDs := loadStreamTokensFromDB()

	token := mainTok
	if token == "" {
		token = firstNonEmpty(os.Getenv("STREAM_MAIN_TOKEN"), os.Getenv("TOKEN"), os.Getenv("DISCORD_BOT_TOKEN"))
	}
	prefix := dbPrefix
	if prefix == "" {
		prefix = firstNonEmpty(os.Getenv("PREFIX"), "$")
	}
	guildID := dbGuildID
	if guildID == "" {
		guildID = os.Getenv("GUILD_ID")
	}
	cmdChanID := dbCmdChanID
	if cmdChanID == "" {
		cmdChanID = os.Getenv("COMMAND_CHANNEL_ID")
	}
	videoChanID := dbVideoChanID
	if videoChanID == "" {
		videoChanID = os.Getenv("VIDEO_CHANNEL_ID")
	}
	adminIDs := dbAdminIDs
	if len(adminIDs) == 0 {
		adminIDs = ParseAdminIDs(os.Getenv("ADMIN_IDS"))
	}

	videosDir := os.Getenv("VIDEOS_DIR")
	if videosDir == "" {
		videosRoot := filepath.Join(root, "videos")
		if info, err := os.Stat(videosRoot); err == nil && info.IsDir() {
			videosDir = videosRoot
		} else {
			videosDir = "./videos"
		}
	}
	previewCacheDir := os.Getenv("PREVIEW_CACHE_DIR")
	if previewCacheDir == "" {
		previewRoot := filepath.Join(root, "tmp", "preview-cache")
		previewCacheDir = previewRoot
	}

	vTok := viewerTok
	if vTok == "" {
		vTok = firstNonEmpty(os.Getenv("STREAM_VIEWER_TOKEN"), os.Getenv("VIEWER_TOKEN"))
	}

	viewerAutoWatch := true
	if raw := os.Getenv("VIEWER_AUTO_WATCH"); raw != "" {
		viewerAutoWatch = ParseBoolean(raw)
	}
	streamLoop := true
	if raw := os.Getenv("STREAM_LOOP"); raw != "" {
		streamLoop = ParseBoolean(raw)
	}
	serverEnabled := true
	if raw := os.Getenv("SERVER_ENABLED"); raw != "" {
		serverEnabled = ParseBoolean(raw)
	}

	return &StreamConfig{
		Token:                       token,
		Prefix:                      prefix,
		GuildID:                     guildID,
		CmdChannelID:                cmdChanID,
		VideoChannelID:              videoChanID,
		VideoChanID:                 videoChanID,
		AdminIDs:                    adminIDs,
		VideosDir:                   videosDir,
		PreviewCacheDir:             previewCacheDir,
		YtdlpCookiesPath:            os.Getenv("YTDLP_COOKIES_PATH"),
		RespectVideoParams:          ParseBoolean(os.Getenv("STREAM_RESPECT_VIDEO_PARAMS")),
		BitrateOverride:             ParseBoolean(os.Getenv("STREAM_BITRATE_OVERRIDE")),
		Width:                       parseIntDefault(os.Getenv("STREAM_WIDTH"), 1280),
		Height:                      parseIntDefault(os.Getenv("STREAM_HEIGHT"), 720),
		FPS:                         parseIntDefault(os.Getenv("STREAM_FPS"), 30),
		BitrateKbps:                 parseIntDefault(os.Getenv("STREAM_BITRATE_KBPS"), 1000),
		MaxBitrateKbps:              parseIntDefault(os.Getenv("STREAM_MAX_BITRATE_KBPS"), 2500),
		MaxWidth:                    parseIntDefault(os.Getenv("STREAM_MAX_WIDTH"), 0),
		MaxHeight:                   parseIntDefault(os.Getenv("STREAM_MAX_HEIGHT"), 0),
		HardwareAcceleratedDecoding: ParseBoolean(os.Getenv("STREAM_HARDWARE_ACCELERATION")),
		H26xPreset:                  ParsePreset(os.Getenv("STREAM_H26X_PRESET")),
		VideoCodec:                  ParseVideoCodec(os.Getenv("STREAM_VIDEO_CODEC")),
		ViewerToken:                 vTok,
		ViewerAutoWatch:             viewerAutoWatch,
		StreamLoop:                  streamLoop,
		ServerEnabled:               serverEnabled,
		ServerPort:                  parseIntDefault(os.Getenv("SERVER_PORT"), 3000),
		ServerUsername:              firstNonEmpty(os.Getenv("SERVER_USERNAME"), "admin"),
		ServerPassword:              firstNonEmpty(os.Getenv("SERVER_PASSWORD"), "admin"),
	}
}

func LoadStreamConfig() *StreamConfig {
	return NewStreamConfig()
}

func (c *StreamConfig) Lock()    { c.mu.Lock() }
func (c *StreamConfig) Unlock()  { c.mu.Unlock() }
func (c *StreamConfig) RLock()   { c.mu.RLock() }
func (c *StreamConfig) RUnlock() { c.mu.RUnlock() }

func (c *StreamConfig) Snapshot() StreamConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	admins := make([]string, len(c.AdminIDs))
	copy(admins, c.AdminIDs)
	return StreamConfig{
		Token:                       c.Token,
		Prefix:                      c.Prefix,
		GuildID:                     c.GuildID,
		CmdChannelID:                c.CmdChannelID,
		VideoChannelID:              c.VideoChannelID,
		VideoChanID:                 c.VideoChanID,
		AdminIDs:                    admins,
		VideosDir:                   c.VideosDir,
		PreviewCacheDir:             c.PreviewCacheDir,
		YtdlpCookiesPath:            c.YtdlpCookiesPath,
		RespectVideoParams:          c.RespectVideoParams,
		BitrateOverride:             c.BitrateOverride,
		Width:                       c.Width,
		Height:                      c.Height,
		FPS:                         c.FPS,
		BitrateKbps:                 c.BitrateKbps,
		MaxBitrateKbps:              c.MaxBitrateKbps,
		MaxWidth:                    c.MaxWidth,
		MaxHeight:                   c.MaxHeight,
		HardwareAcceleratedDecoding: c.HardwareAcceleratedDecoding,
		H26xPreset:                  c.H26xPreset,
		VideoCodec:                  c.VideoCodec,
		ViewerToken:                 c.ViewerToken,
		ViewerAutoWatch:             c.ViewerAutoWatch,
		StreamLoop:                  c.StreamLoop,
		ServerEnabled:               c.ServerEnabled,
		ServerPort:                  c.ServerPort,
		ServerUsername:              c.ServerUsername,
		ServerPassword:              c.ServerPassword,
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func parseIntDefault(raw string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return def
	}
	return n
}
