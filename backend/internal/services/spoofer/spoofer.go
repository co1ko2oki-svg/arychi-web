package spoofer

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"arychi-web/backend/internal/config"
	"github.com/google/uuid"
)

const (
	MeURL         = "https://discord.com/api/v9/users/@me?with_analytics_token=true"
	ScienceURL    = "https://discord.com/api/v9/science"
	PropertiesURL = "https://cordapi.dolfi.es/api/v2/properties/windows"
	GamesCDNURL   = "https://cdn.discordapp.com/detectables/games.json"

	BatchSize         = 50
	BatchDelay        = 300 * time.Millisecond
	AuthMaxAgeSeconds = 12 * 3600

	ClientVersion     = "1.0.9253"
	ClientBuildNumber = 594031
	NativeBuildNumber = 88414
	OSVersion         = "10.0.26200"
	UserAgent         = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9253 Chrome/148.0.7778.280 Electron/42.7.1 Safari/537.36"
)

const fingerprintPS1 = `
param(
  [int]$ProcessId = 0,
  [string]$Path,
  [Parameter(Mandatory = $true)][string]$UserId
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class CertPubKeyHash {
  const uint X509_ASN_ENCODING = 0x00000001;
  const uint PKCS_7_ASN_ENCODING = 0x00010000;
  const uint CALG_SHA_256 = 0x0000800C;

  [StructLayout(LayoutKind.Sequential)] struct Blob { public uint cbData; public IntPtr pbData; }
  [StructLayout(LayoutKind.Sequential)] struct AlgId { public IntPtr pszObjId; public Blob Parameters; }
  [StructLayout(LayoutKind.Sequential)] struct BitBlob { public uint cbData; public IntPtr pbData; public uint cUnusedBits; }
  [StructLayout(LayoutKind.Sequential)] struct PubKeyInfo { public AlgId Algorithm; public BitBlob PublicKey; }
  [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low; public uint High; }
  [StructLayout(LayoutKind.Sequential)]
  struct CertInfo {
    public uint Version; public Blob SerialNumber; public AlgId SignatureAlgorithm; public Blob Issuer;
    public FileTime NotBefore; public FileTime NotAfter; public Blob Subject;
    public PubKeyInfo SubjectPublicKeyInfo; public BitBlob IssuerUniqueId; public BitBlob SubjectUniqueId;
    public uint ExtensionCount; public IntPtr Extensions;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct CertContext {
    public uint EncodingType; public IntPtr Encoded; public uint EncodedSize;
    public IntPtr CertInfo; public IntPtr Store;
  }

  [DllImport("crypt32.dll", SetLastError = true)]
  static extern bool CryptHashPublicKeyInfo(
    IntPtr provider, uint algid, uint flags, uint encoding, ref PubKeyInfo info, byte[] hash, ref uint hashSize);

  public static byte[] Hash(IntPtr certContext) {
    var ctx = Marshal.PtrToStructure<CertContext>(certContext);
    var info = Marshal.PtrToStructure<CertInfo>(ctx.CertInfo);
    var hash = new byte[32];
    uint hashSize = 32;
    if (!CryptHashPublicKeyInfo(IntPtr.Zero, CALG_SHA_256, 0, X509_ASN_ENCODING | PKCS_7_ASN_ENCODING, ref info.SubjectPublicKeyInfo, hash, ref hashSize) || hashSize != 32)
      throw new InvalidOperationException("CryptHashPublicKeyInfo failed");
    return hash;
  }
}
"@

if (!$Path) {
  if (!$ProcessId) { throw "Pass -Path <exe> or -ProcessId <pid>." }
  $Path = (Get-Process -Id $ProcessId).Path
}
if (!$Path) { throw "Could not resolve executable path." }

$fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete)
try {
  $fileSize = [UInt64]$fs.Length
  $readSize = [int][Math]::Min($fs.Length, 0x10000)
  $buf = [byte[]]::new($readSize)
  $read = $fs.Read($buf, 0, $readSize)
  if ($read -lt 0x40) { throw "File prefix is too small." }
  if ($read -ne $readSize) { [Array]::Resize([ref]$buf, $read) }
} finally {
  $fs.Dispose()
}

if ([BitConverter]::ToUInt16($buf, 0) -ne 0x5A4D) { throw "Not an MZ executable." }
$pe = [BitConverter]::ToInt32($buf, 0x3C)
if ($pe -lt 0 -or [BitConverter]::ToUInt32($buf, $pe) -ne 0x4550) { throw "Not a PE executable." }

$fh = $pe + 4
$sections = [BitConverter]::ToUInt16($buf, $fh + 2)
$timestamp = [BitConverter]::ToUInt32($buf, $fh + 4)
$optSize = [BitConverter]::ToUInt16($buf, $fh + 16)
$opt = $fh + 20
$isPe32Plus = [BitConverter]::ToUInt16($buf, $opt) -eq 0x20B
if (!$isPe32Plus) { throw "Discord only fingerprints PE32+." }
$sizeOfImage = [BitConverter]::ToUInt32($buf, $opt + 56)

$sectionTable = $opt + $optSize
$sha256 = [Security.Cryptography.SHA256]::Create()
$headerHash = $sha256.ComputeHash([byte[]]$buf[0..($sectionTable - 1)])
$sectionHash = $sha256.ComputeHash([byte[]]$buf[$sectionTable..($sectionTable + $sections * 40 - 1)])

$machineGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name MachineGuid).MachineGuid
$machineUserHash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($machineGuid + $UserId))

$sig = Get-AuthenticodeSignature -LiteralPath $Path
$signed = $sig.Status -eq "Valid" -and $sig.SignerCertificate
if ($signed) {
  $name = $sig.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  $certHash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($name) + [CertPubKeyHash]::Hash($sig.SignerCertificate.Handle))
} else {
  $certHash = [byte[]]::new(32)
}

$flags = 0
if ($signed) { $flags += 1 }
if ($isPe32Plus) { $flags += 2 }

$out = [byte[]](@(1, [byte]$flags) +
  [BitConverter]::GetBytes($fileSize) +
  [BitConverter]::GetBytes($timestamp) +
  [BitConverter]::GetBytes($sizeOfImage) +
  $headerHash + $machineUserHash + $sectionHash + $certHash)

$key = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($UserId + "https://discord.com/careers"))
for ($i = 1; $i -lt $out.Length; $i++) {
  $out[$i] = $out[$i] -bxor $key[($i - 1) -band 31]
}

[Convert]::ToBase64String($out)
`

func UserIDFromToken(token string) string {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	first := parts[0]
	pad := (4 - len(first)%4) % 4
	first += strings.Repeat("=", pad)
	decoded, err := base64.StdEncoding.DecodeString(first)
	if err != nil {
		decoded, err = base64.URLEncoding.DecodeString(first)
		if err != nil {
			return ""
		}
	}
	return string(decoded)
}

func GenerateFingerprint(userID, exePath string, pid int) (string, error) {
	if runtime.GOOS != "windows" {
		return "", fmt.Errorf("fingerprint generation is windows-only")
	}
	scriptPath := filepath.Join(os.TempDir(), fmt.Sprintf("disc_fp_%s.ps1", strings.ReplaceAll(uuid.NewString(), "-", "")))
	if err := os.WriteFile(scriptPath, []byte(fingerprintPS1), 0600); err != nil {
		return "", err
	}
	defer os.Remove(scriptPath)

	args := []string{"-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-UserId", userID}
	if pid > 0 {
		args = append(args, "-ProcessId", strconv.Itoa(pid))
	} else {
		args = append(args, "-Path", exePath)
	}

	cmd := exec.Command("powershell", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
			return "", fmt.Errorf("%s", strings.TrimSpace(lines[len(lines)-1]))
		}
		return "", fmt.Errorf("powershell failed: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line != "" {
			return line, nil
		}
	}
	return "", fmt.Errorf("generator produced no output")
}

type State struct {
	Token             string   `json:"token"`
	Cookie            string   `json:"cookie"`
	Fingerprint       string   `json:"fingerprint"`
	AnalyticsToken    string   `json:"analytics_token"`
	FetchedAt         int64    `json:"fetched_at"`
	UsedGames         []string `json:"used_games"`
	TotalGamesClaimed int      `json:"total_games_claimed"`
	TotalHoursClaimed float64  `json:"total_hours_claimed"`
}

func ResolveStateFilePath() string {
	root := config.ResolveWorkspaceRoot()
	candidate := filepath.Join(root, "data", "science_state.json")
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	legacy := filepath.Join(root, "badge-farm", "science_state.json")
	if _, err := os.Stat(legacy); err == nil {
		return legacy
	}
	return candidate
}

func ResolveGamesFilePath() string {
	root := config.ResolveWorkspaceRoot()
	return filepath.Join(root, "data", "games.json")
}

func LoadState() *State {
	stateFile := ResolveStateFilePath()
	s := &State{UsedGames: []string{}}
	data, err := os.ReadFile(stateFile)
	if err == nil {
		_ = json.Unmarshal(data, s)
		if s.UsedGames == nil {
			s.UsedGames = []string{}
		}
	}
	return s
}

func (s *State) Save() error {
	stateFile := ResolveStateFilePath()
	_ = os.MkdirAll(filepath.Dir(stateFile), 0755)
	if s.UsedGames == nil {
		s.UsedGames = []string{}
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(stateFile, data, 0644)
}

func (s *State) IsStale() bool {
	return s.AnalyticsToken == "" || (time.Now().Unix()-s.FetchedAt) > AuthMaxAgeSeconds
}

func (s *State) HasCookie() bool {
	return strings.TrimSpace(s.Cookie) != ""
}

func (s *State) HasToken() bool {
	return strings.TrimSpace(s.Token) != ""
}

func localProps() map[string]any {
	return map[string]any{
		"os":                  "Windows",
		"browser":             "Discord Client",
		"release_channel":     "stable",
		"client_version":      ClientVersion,
		"os_version":          OSVersion,
		"os_arch":             "x64",
		"app_arch":            "x64",
		"system_locale":       "en-GB",
		"has_client_mods":     false,
		"browser_user_agent":  UserAgent,
		"browser_version":     "42.7.1",
		"os_sdk_version":      "26200",
		"client_build_number": ClientBuildNumber,
		"native_build_number": NativeBuildNumber,
		"client_event_source": nil,
		"client_app_state":    "focused",
	}
}

func BuildSuperProps(launchSignature, heartbeatSession string) string {
	var props map[string]any
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, PropertiesURL, bytes.NewReader([]byte("{}")))
	if err == nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", UserAgent)
		if resp, err := client.Do(req); err == nil {
			defer resp.Body.Close()
			var parsed struct {
				Properties map[string]any `json:"properties"`
			}
			if json.NewDecoder(resp.Body).Decode(&parsed) == nil && len(parsed.Properties) > 0 {
				props = parsed.Properties
			}
		}
	}
	if props == nil {
		props = localProps()
	}
	props["client_launch_id"] = uuid.NewString()
	props["launch_signature"] = launchSignature
	props["client_heartbeat_session_id"] = heartbeatSession

	raw, _ := json.Marshal(props)
	return base64.StdEncoding.EncodeToString(raw)
}

func ReadAnalyticsToken(authToken, superProps string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, MeURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", authToken)
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("X-Super-Properties", superProps)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("token rejected (%d)", resp.StatusCode)
	}

	var data struct {
		AnalyticsToken string `json:"analytics_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}
	if data.AnalyticsToken == "" {
		return "", fmt.Errorf("no analytics_token in response")
	}
	return data.AnalyticsToken, nil
}

func EnsureToken(state *State, superProps string) error {
	if !state.IsStale() {
		return nil
	}
	tok, err := ReadAnalyticsToken(state.Token, superProps)
	if err != nil {
		return err
	}
	state.AnalyticsToken = tok
	state.FetchedAt = time.Now().Unix()
	_ = state.Save()
	return nil
}

type Session struct {
	HeartbeatSession string
	LaunchSignature  string
	SuperProps       string
}

func NewSession() *Session {
	hb := uuid.NewString()
	sig := uuid.NewString()
	return &Session{
		HeartbeatSession: hb,
		LaunchSignature:  sig,
		SuperProps:       BuildSuperProps(sig, hb),
	}
}

type Game struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Exe  string `json:"exe"`
}

func parseGames(raw []byte) ([]Game, error) {
	var entries []struct {
		ID          any    `json:"id"`
		Name        string `json:"name"`
		Executables []struct {
			OS   string `json:"os"`
			Name string `json:"name"`
		} `json:"executables"`
	}
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, err
	}

	var games []Game
	seen := make(map[string]bool)
	for _, entry := range entries {
		gid := fmt.Sprintf("%v", entry.ID)
		if gid == "" || seen[gid] {
			continue
		}
		isDigits := true
		for _, ch := range gid {
			if ch < '0' || ch > '9' {
				isDigits = false
				break
			}
		}
		if !isDigits {
			continue
		}

		winExe := ""
		for _, ex := range entry.Executables {
			if ex.OS == "win32" && ex.Name != "" {
				winExe = ex.Name
				break
			}
		}
		if winExe == "" {
			continue
		}

		seen[gid] = true
		name := entry.Name
		if name == "" {
			name = "Unknown"
		}
		games = append(games, Game{
			ID:   gid,
			Name: name,
			Exe:  winExe,
		})
	}
	return games, nil
}

func LoadGames() []Game {
	gamesFile := ResolveGamesFilePath()
	if data, err := os.ReadFile(gamesFile); err == nil && len(bytes.TrimSpace(data)) > 0 {
		if games, err := parseGames(data); err == nil && len(games) > 0 {
			return games
		}
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(http.MethodGet, GamesCDNURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	_ = os.MkdirAll(filepath.Dir(gamesFile), 0755)
	_ = os.WriteFile(gamesFile, raw, 0644)

	games, _ := parseGames(raw)
	return games
}

type ScienceClient struct {
	State      *State
	Session    *Session
	seq        int64
	httpClient *http.Client
}

func NewScienceClient(state *State, session *Session) *ScienceClient {
	return &ScienceClient{
		State:      state,
		Session:    session,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *ScienceClient) nextSeq() int64 {
	return atomic.AddInt64(&c.seq, 1)
}

func (c *ScienceClient) BuildLaunch(game Game) map[string]any {
	now := time.Now().UnixMilli()
	props := map[string]any{
		"client_track_timestamp":        now,
		"client_heartbeat_session_id":   c.Session.HeartbeatSession,
		"event_sequence_number":         c.nextSeq(),
		"game":                          game.Name,
		"game_id":                       game.ID,
		"verified":                      true,
		"elevated":                      false,
		"is_launcher":                   false,
		"game_platform":                 "desktop",
		"detection_method":              "verified_game",
		"is_overlay_enabled":            false,
		"is_overlay_game_enabled":       true,
		"is_overlay_game_source":        "OOP_DEFAULT_DATABASE",
		"fullscreen_type":               "UNKNOWN",
		"hardware_display_count":        1,
		"overlay_method":                "Disabled",
		"activity_status_enabled":       true,
		"activity_status_shared_guilds": []string{},
		"current_user_status":           "online",
		"game_detection_enabled":        true,
		"executable_path":               game.Exe,
		"voice_channel_id":              nil,
		"voice_channel_type":            nil,
		"voice_channel_bitrate":         nil,
		"voice_channel_guild_id":        nil,
		"hidden_by_distributor":         false,
		"game_metadata":                 nil,
		"client_performance_cpu":        nil,
		"client_performance_memory":     nil,
		"cpu_core_count":                nil,
		"accessibility_features":        0,
		"rendered_locale":               "en-GB",
		"launch_signature":              c.Session.LaunchSignature,
		"client_rtc_state":              nil,
		"client_app_state":              "focused",
		"client_send_timestamp":         now,
	}
	if c.State.Fingerprint != "" {
		props["executable_fingerprint"] = c.State.Fingerprint
	}
	return map[string]any{
		"type":       "launch_game",
		"properties": props,
	}
}

func (c *ScienceClient) BuildHeartbeat(game Game, durationMs int64, sessionID string, initial, final bool, ts int64) map[string]any {
	if ts <= 0 {
		ts = time.Now().UnixMilli()
	}
	return map[string]any{
		"type": "running_game_heartbeat",
		"properties": map[string]any{
			"client_track_timestamp":      ts,
			"client_heartbeat_session_id": c.Session.HeartbeatSession,
			"event_sequence_number":       c.nextSeq(),
			"game_id":                     game.ID,
			"game_name":                   game.Name,
			"game_metadata":               nil,
			"game_executable":             game.Exe,
			"game_detection_enabled":      true,
			"initial_heartbeat":           initial,
			"final_heartbeat":             final,
			"game_session_id":             sessionID,
			"duration_tracked_ms":         durationMs,
			"rtc_connection_id":           nil,
			"media_session_id":            nil,
			"launch_signature":            c.Session.LaunchSignature,
			"client_app_state":            "focused",
			"client_send_timestamp":       ts,
		},
	}
}

func (c *ScienceClient) BuildSession(game Game, durationMs int64) []map[string]any {
	sid := uuid.NewString()
	now := time.Now().UnixMilli()
	start := now - durationMs
	if start < 0 {
		start = now
	}
	return []map[string]any{
		c.BuildHeartbeat(game, 0, sid, true, false, start),
		c.BuildLaunch(game),
		c.BuildHeartbeat(game, durationMs, sid, false, true, now),
	}
}

func (c *ScienceClient) Post(events []map[string]any) int {
	payload := map[string]any{
		"token":  c.State.AnalyticsToken,
		"events": events,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0
	}

	req, err := http.NewRequest(http.MethodPost, ScienceURL, bytes.NewReader(body))
	if err != nil {
		return 0
	}
	req.Header.Set("accept", "*/*")
	req.Header.Set("accept-language", "en-GB")
	req.Header.Set("authorization", c.State.Token)
	req.Header.Set("content-type", "application/json")
	req.Header.Set("cookie", c.State.Cookie)
	req.Header.Set("origin", "https://discord.com")
	req.Header.Set("referer", "https://discord.com/channels/@me")
	req.Header.Set("user-agent", UserAgent)
	req.Header.Set("x-debug-options", "bugReporterEnabled")
	req.Header.Set("x-discord-locale", "en-GB")
	req.Header.Set("x-discord-timezone", "Europe/Oslo")
	req.Header.Set("x-super-properties", c.Session.SuperProps)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode
}

type Console struct {
	mu sync.Mutex
}

const (
	ansiRed    = "\x1b[91m"
	ansiOrange = "\x1b[38;5;208m"
	ansiGreen  = "\x1b[92m"
	ansiYellow = "\x1b[93m"
	ansiWhite  = "\x1b[97m"
	ansiGrey   = "\x1b[90m"
	ansiReset  = "\x1b[0m"
	ansiRule   = "────────────────────────────────────────────"
)

func NewConsole() *Console {
	return &Console{}
}

func (c *Console) stamp() string {
	return fmt.Sprintf("%s%s%s", ansiGrey, time.Now().Format("15:04:05"), ansiReset)
}

func (c *Console) line(glyph, target, detail, color string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	fmt.Printf("  %s %s %s%s%s %s·%s %s%s%s\n",
		c.stamp(), glyph, ansiWhite, target, ansiReset, ansiGrey, ansiReset, color, detail, ansiReset)
}

func (c *Console) OK(target, detail string) {
	c.line(fmt.Sprintf("%s✓%s", ansiGreen, ansiReset), target, detail, ansiGreen)
}

func (c *Console) Sent(target, detail string) {
	c.line(fmt.Sprintf("%s·%s %ssent%s", ansiGrey, ansiReset, ansiGreen, ansiReset), target, detail, ansiGreen)
}

func (c *Console) Warn(target, detail string) {
	c.line(fmt.Sprintf("%s!%s", ansiYellow, ansiReset), target, detail, ansiYellow)
}

func (c *Console) Err(target, detail string) {
	c.line(fmt.Sprintf("%s✗%s", ansiRed, ansiReset), target, detail, ansiRed)
}

func (c *Console) Info(detail string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	fmt.Printf("  %s %s·%s %s%s%s\n", c.stamp(), ansiGrey, ansiReset, ansiWhite, detail, ansiReset)
}

func (c *Console) Rule() {
	c.mu.Lock()
	defer c.mu.Unlock()
	fmt.Printf("  %s%s%s\n", ansiGrey, ansiRule, ansiReset)
}

func (c *Console) Clear() {
	fmt.Print("\x1b[2J\x1b[3J\x1b[H")
}

func (c *Console) Banner() {
	c.Clear()
	fmt.Println()
	fmt.Printf("  %sspoofer%s %s·%s %sdiscord badges%s\n", ansiOrange, ansiReset, ansiGrey, ansiReset, ansiWhite, ansiReset)
	fmt.Printf("    %sby revere group%s\n\n", ansiGrey, ansiReset)
}

type Spoofer struct {
	Client  *ScienceClient
	Console *Console
	Workers int
}

func NewSpoofer(client *ScienceClient, console *Console, workers int) *Spoofer {
	if workers < 1 {
		workers = 1
	}
	return &Spoofer{
		Client:  client,
		Console: console,
		Workers: workers,
	}
}

func (s *Spoofer) Run(games []Game, buildEvents func(Game) []map[string]any) int {
	total := len(games)
	if total == 0 {
		return 0
	}

	var chunks [][]Game
	for start := 0; start < total; start += BatchSize {
		end := start + BatchSize
		if end > total {
			end = total
		}
		chunks = append(chunks, games[start:end])
	}

	totalBatches := len(chunks)
	var sentOK int
	var mu sync.Mutex
	var stopped int32

	type batchJob struct {
		idx   int
		chunk []Game
	}

	jobs := make(chan batchJob, totalBatches)
	for i, ch := range chunks {
		jobs <- batchJob{idx: i + 1, chunk: ch}
	}
	close(jobs)

	var wg sync.WaitGroup
	for w := 0; w < s.Workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				if atomic.LoadInt32(&stopped) == 1 {
					return
				}
				var batchEvents []map[string]any
				for _, g := range job.chunk {
					batchEvents = append(batchEvents, buildEvents(g)...)
				}
				status := s.Client.Post(batchEvents)
				mu.Lock()
				switch status {
				case 204:
					sentOK += len(job.chunk)
					s.Console.Sent(fmt.Sprintf("batch %d/%d", job.idx, totalBatches), fmt.Sprintf("%d/%d games", sentOK, total))
				case 401, 403:
					s.Console.Err(fmt.Sprintf("batch %d/%d", job.idx, totalBatches), fmt.Sprintf("[%d] auth rejected · refresh (option 4) with a fresh cookie", status))
					atomic.StoreInt32(&stopped, 1)
				default:
					s.Console.Warn(fmt.Sprintf("batch %d/%d", job.idx, totalBatches), fmt.Sprintf("[%d]", status))
				}
				mu.Unlock()
				time.Sleep(BatchDelay)
			}
		}()
	}

	wg.Wait()
	return sentOK
}

type CLIArgs struct {
	Hours      *float64
	Threads    int
	Games      *int
	MarkPlayed *int
	Token      string
	Cookie     string
}

type App struct {
	Console *Console
	State   *State
	Session *Session
	Client  *ScienceClient
	Games   []Game
	reader  *bufio.Reader
}

func NewApp() *App {
	return &App{
		Console: NewConsole(),
		State:   LoadState(),
		reader:  bufio.NewReader(os.Stdin),
	}
}

func (a *App) readLine(prompt string) string {
	fmt.Print(prompt)
	line, _ := a.reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func (a *App) newSession() {
	a.Session = NewSession()
	a.Client = NewScienceClient(a.State, a.Session)
}

func (a *App) Start(args *CLIArgs) {
	a.Console.Banner()
	time.Sleep(300 * time.Millisecond)
	fmt.Println()

	if args != nil && args.Token != "" {
		a.State.Token = args.Token
		_ = a.State.Save()
	}
	if args != nil && args.Cookie != "" {
		a.State.Cookie = args.Cookie
		_ = a.State.Save()
	}

	if !a.State.HasToken() {
		a.promptToken()
	} else {
		a.Console.OK("auth", "token loaded")
	}
	if !a.State.HasToken() {
		a.Console.Err("token", "required to run")
		return
	}

	if !a.State.HasCookie() {
		a.Console.Banner()
		a.promptCookie()
	} else {
		a.Console.OK("auth", "cookie loaded")
	}
	if !a.State.HasCookie() {
		a.Console.Err("cookie", "required to run")
		return
	}

	a.Console.Banner()
	fmt.Println()
	a.Console.Info("loading games...")
	a.Games = LoadGames()
	if len(a.Games) == 0 {
		a.Console.Err("games", "couldn't load the game list")
		a.Console.Info(fmt.Sprintf("tried %s and %s", ResolveGamesFilePath(), GamesCDNURL))
		return
	}
	a.Console.OK("games", fmt.Sprintf("%s%d%s loaded", ansiOrange, len(a.Games), ansiWhite))

	if a.State.Fingerprint == "" {
		fmt.Println()
		a.Console.Warn("fingerprint", "not set · script may not credit the badges")
	}

	fmt.Println()
	a.Console.Info("validating auth...")
	a.newSession()
	if err := EnsureToken(a.State, a.Session.SuperProps); err != nil {
		a.Console.Err("token", err.Error())
		return
	}
	a.Console.OK("auth", "ready")

	if args != nil && (args.Hours != nil || args.MarkPlayed != nil) {
		workers := args.Threads
		if workers < 1 {
			workers = 2
		}
		if args.Hours != nil && args.MarkPlayed != nil {
			a.ClaimBoth(workers, args.Games, args.Hours, args.MarkPlayed, false)
		} else if args.Hours != nil {
			a.ClaimGames(workers, args.Games, args.Hours, false)
		} else if args.MarkPlayed != nil {
			a.MarkGamesPlayed(workers, args.MarkPlayed, false)
		}
		return
	}

	fmt.Println()
	a.Menu()
}

func (a *App) promptToken() {
	a.Console.Info("paste your discord account token")
	entered := a.readLine(fmt.Sprintf("  %stoken:%s ", ansiGrey, ansiReset))
	if entered != "" {
		a.State.Token = entered
		_ = a.State.Save()
		a.Console.OK("token", "saved")
	}
}

func (a *App) promptCookie() {
	a.Console.Info("paste your cf_clearance cookie header")
	entered := a.readLine(fmt.Sprintf("  %scookie:%s ", ansiGrey, ansiReset))
	if entered != "" {
		a.State.Cookie = entered
		_ = a.State.Save()
		a.Console.OK("cookie", "saved")
	}
}

func (a *App) refresh() {
	a.Console.Info("update cookie? [y/n]")
	choice := strings.ToLower(a.readLine(fmt.Sprintf("  %s›%s ", ansiGrey, ansiReset)))
	if choice == "y" || choice == "yes" {
		a.Console.Info("paste a fresh cookie header")
		entered := a.readLine(fmt.Sprintf("  %scookie:%s ", ansiGrey, ansiReset))
		if entered != "" {
			a.State.Cookie = entered
			a.Console.OK("cookie", "updated")
		} else {
			a.Console.Info("cookie unchanged")
		}
	}

	a.Console.Info("refreshing analytics token...")
	a.State.FetchedAt = 0
	if err := EnsureToken(a.State, a.Session.SuperProps); err != nil {
		a.Console.Err("auth", err.Error())
		return
	}
	a.newSession()
	_ = a.State.Save()
	a.Console.OK("auth", "refreshed")
}

func (a *App) requireReady() bool {
	if !a.State.HasCookie() {
		a.Console.Err("cookie", "not set · use option 4 to add one")
		return false
	}
	if a.State.IsStale() {
		if err := EnsureToken(a.State, a.Session.SuperProps); err != nil {
			a.Console.Err("auth", err.Error())
			return false
		}
		a.newSession()
	}
	return a.State.AnalyticsToken != ""
}

func (a *App) selectGames(count int) []Game {
	if count <= 0 || count > len(a.Games) {
		count = len(a.Games)
	}
	availableIDs := make(map[string]bool, len(a.Games))
	idMap := make(map[string]Game, len(a.Games))
	for _, g := range a.Games {
		availableIDs[g.ID] = true
		idMap[g.ID] = g
	}

	usedSet := make(map[string]bool, len(a.State.UsedGames))
	var usedIDs []string
	for _, gid := range a.State.UsedGames {
		usedSet[gid] = true
		if availableIDs[gid] {
			usedIDs = append(usedIDs, gid)
		}
	}

	var unusedIDs []string
	for _, g := range a.Games {
		if !usedSet[g.ID] {
			unusedIDs = append(unusedIDs, g.ID)
		}
	}

	var selectedIDs []string
	if len(unusedIDs) >= count {
		selectedIDs = unusedIDs[:count]
	} else {
		selectedIDs = append(selectedIDs, unusedIDs...)
		if len(usedIDs) > 0 {
			rem := count - len(selectedIDs)
			if rem > len(usedIDs) {
				rem = len(usedIDs)
			}
			rotated := append(usedIDs[rem:], usedIDs[:rem]...)
			selectedIDs = append(selectedIDs, rotated[:rem]...)
		}
	}

	selSet := make(map[string]bool, len(selectedIDs))
	for _, gid := range selectedIDs {
		selSet[gid] = true
	}
	var nextUsed []string
	for _, gid := range a.State.UsedGames {
		if !selSet[gid] {
			nextUsed = append(nextUsed, gid)
		}
	}
	nextUsed = append(nextUsed, selectedIDs...)
	a.State.UsedGames = nextUsed

	var res []Game
	for _, gid := range selectedIDs {
		if g, ok := idMap[gid]; ok {
			res = append(res, g)
		}
	}
	return res
}

func (a *App) ClaimGames(workers int, countPtr *int, hoursPtr *float64, interactive bool) {
	if !a.requireReady() {
		return
	}
	fmt.Println()
	a.Console.Info(fmt.Sprintf("loaded %s%d%s games available", ansiGreen, len(a.Games), ansiWhite))

	count := len(a.Games)
	if countPtr != nil && *countPtr > 0 {
		count = *countPtr
	} else if interactive {
		rawCount := a.readLine(fmt.Sprintf("  %show many games? [all]:%s ", ansiGrey, ansiReset))
		if rawCount != "" {
			parsed, err := strconv.Atoi(rawCount)
			if err != nil {
				a.Console.Err("input", "invalid count")
				return
			}
			count = parsed
		}
	}
	if count > len(a.Games) {
		count = len(a.Games)
	}

	hours := 1.0
	if hoursPtr != nil {
		hours = *hoursPtr
	} else if interactive {
		rawHours := a.readLine(fmt.Sprintf("  %shours per game? [1]:%s ", ansiGrey, ansiReset))
		if rawHours != "" {
			parsed, err := strconv.ParseFloat(rawHours, 64)
			if err != nil {
				a.Console.Err("input", "invalid hours")
				return
			}
			hours = parsed
		}
	}

	selected := a.selectGames(count)
	if len(selected) == 0 {
		a.Console.Err("games", "none selected")
		return
	}

	durationMs := int64(hours * 3600 * 1000)
	totalHours := float64(len(selected)) * hours
	fmt.Println()
	a.Console.Info(fmt.Sprintf("claiming %s%gh%s on %s%d%s games %s·%s %.0fh total (%d luồng)",
		ansiOrange, hours, ansiWhite, ansiOrange, len(selected), ansiWhite, ansiGrey, ansiWhite, totalHours, workers))
	a.Console.Rule()

	ok := NewSpoofer(a.Client, a.Console, workers).Run(selected, func(g Game) []map[string]any {
		return a.Client.BuildSession(g, durationMs)
	})
	fmt.Println()
	a.Console.OK("complete", fmt.Sprintf("%d/%d games · %.0fh claimed", ok, len(selected), float64(ok)*hours))

	a.State.TotalGamesClaimed += ok
	a.State.TotalHoursClaimed += float64(ok) * hours
	_ = a.State.Save()

	a.Console.Rule()
	if interactive {
		a.readLine(fmt.Sprintf("  %s›%s press enter to continue", ansiOrange, ansiReset))
		a.Console.Rule()
	}
}

func (a *App) MarkGamesPlayed(workers int, countPtr *int, interactive bool) {
	if !a.requireReady() {
		return
	}
	fmt.Println()
	targetGames := a.Games
	if countPtr != nil && *countPtr > 0 && *countPtr < len(a.Games) {
		targetGames = a.Games[:*countPtr]
	}
	a.Console.Info(fmt.Sprintf("marking %s%d%s games as played (%d luồng)", ansiOrange, len(targetGames), ansiWhite, workers))
	a.Console.Rule()

	durationMs := int64(60000)
	ok := NewSpoofer(a.Client, a.Console, workers).Run(targetGames, func(g Game) []map[string]any {
		return a.Client.BuildSession(g, durationMs)
	})
	fmt.Println()
	a.Console.OK("complete", fmt.Sprintf("%d/%d games marked as played", ok, len(targetGames)))

	a.State.TotalGamesClaimed += ok
	a.State.TotalHoursClaimed += float64(ok) * (1.0 / 60.0)
	_ = a.State.Save()

	a.Console.Rule()
	if interactive {
		a.readLine(fmt.Sprintf("  %s›%s press enter to continue", ansiOrange, ansiReset))
		a.Console.Rule()
	}
}

func (a *App) ClaimBoth(workers int, countPtr *int, hoursPtr *float64, markCountPtr *int, interactive bool) {
	if !a.requireReady() {
		return
	}
	fmt.Println()
	a.Console.Info(fmt.Sprintf("chạy cả 2: Treo giờ chơi + Đánh dấu game (%d luồng)", workers))

	hours := 1.0
	if hoursPtr != nil {
		hours = *hoursPtr
	} else if interactive {
		rawHours := a.readLine(fmt.Sprintf("  %shours per game? [1]:%s ", ansiGrey, ansiReset))
		if rawHours != "" {
			parsed, err := strconv.ParseFloat(rawHours, 64)
			if err != nil {
				a.Console.Err("input", "invalid hours")
				return
			}
			hours = parsed
		}
	}

	playGames := a.Games
	if countPtr != nil && *countPtr > 0 {
		playGames = a.selectGames(*countPtr)
	}
	durationMs := int64(hours * 3600 * 1000)
	totalHours := float64(len(playGames)) * hours
	fmt.Println()
	a.Console.Info(fmt.Sprintf("[1/2] Đang treo giờ chơi (%gh/game trên %d games) · %.0fh total", hours, len(playGames), totalHours))
	a.Console.Rule()

	ok1 := NewSpoofer(a.Client, a.Console, workers).Run(playGames, func(g Game) []map[string]any {
		return a.Client.BuildSession(g, durationMs)
	})
	a.State.TotalGamesClaimed += ok1
	a.State.TotalHoursClaimed += float64(ok1) * hours
	_ = a.State.Save()
	fmt.Println()
	a.Console.OK("playtime", fmt.Sprintf("%d/%d games · %.0fh claimed", ok1, len(playGames), float64(ok1)*hours))

	targetMark := a.Games
	if markCountPtr != nil && *markCountPtr > 0 && *markCountPtr < len(a.Games) {
		targetMark = a.Games[:*markCountPtr]
	}
	fmt.Println()
	a.Console.Info(fmt.Sprintf("[2/2] Đang đánh dấu %d game là đã chơi (1 min each)", len(targetMark)))
	a.Console.Rule()

	ok2 := NewSpoofer(a.Client, a.Console, workers).Run(targetMark, func(g Game) []map[string]any {
		return a.Client.BuildSession(g, 60000)
	})
	a.State.TotalGamesClaimed += ok2
	a.State.TotalHoursClaimed += float64(ok2) * (1.0 / 60.0)
	_ = a.State.Save()
	fmt.Println()
	a.Console.OK("complete", fmt.Sprintf("Hoàn thành cả 2 tác vụ! (Playtime: %d games, Played: %d games)", ok1, ok2))
	a.Console.Rule()
	if interactive {
		a.readLine(fmt.Sprintf("  %s›%s press enter to continue", ansiOrange, ansiReset))
		a.Console.Rule()
	}
}

func (a *App) SetFingerprint() {
	uid := UserIDFromToken(a.State.Token)
	if uid == "" {
		a.Console.Err("fingerprint", "no valid token · set one first")
		return
	}
	if runtime.GOOS != "windows" {
		a.Console.Err("fingerprint", "windows-only feature")
		return
	}
	a.Console.Info("generate an executable_fingerprint tied to this account + machine")
	a.Console.Info(fmt.Sprintf("account: %s%s%s", ansiOrange, uid, ansiReset))
	a.Console.Info("point it at a game's .exe (or a running game's pid)")
	entered := strings.Trim(a.readLine(fmt.Sprintf("  %sexe path or pid:%s ", ansiGrey, ansiReset)), "\"")
	if entered == "" {
		a.Console.Info("cancelled")
		return
	}
	pid, err := strconv.Atoi(entered)
	exePath := ""
	if err != nil {
		pid = 0
		exePath = entered
		if _, statErr := os.Stat(exePath); statErr != nil {
			a.Console.Err("fingerprint", fmt.Sprintf("file not found: %s", exePath))
			return
		}
	}
	a.Console.Info("generating...")
	fp, fpErr := GenerateFingerprint(uid, exePath, pid)
	if fpErr != nil {
		a.Console.Err("fingerprint", fpErr.Error())
		return
	}
	a.State.Fingerprint = fp
	_ = a.State.Save()
	a.Console.OK("fingerprint", fmt.Sprintf("set (%d chars) · saved to %s", len(fp), filepath.Base(ResolveStateFilePath())))
}

func (a *App) Menu() {
	for {
		a.Console.Clear()
		a.Console.Banner()
		fmt.Println()
		a.Console.Info(fmt.Sprintf("loaded %s%d%s games", ansiOrange, len(a.Games), ansiWhite))
		a.Console.Info(fmt.Sprintf("claimed %s%d%s games · %s%.0fh%s total",
			ansiOrange, a.State.TotalGamesClaimed, ansiWhite, ansiOrange, a.State.TotalHoursClaimed, ansiWhite))
		a.Console.Rule()
		a.Console.Info(fmt.Sprintf("%s1%s · claim playtime (treo giờ chơi - 2 luồng)", ansiOrange, ansiReset))
		a.Console.Info(fmt.Sprintf("%s2%s · games played (đánh dấu đã chơi - 2 luồng)", ansiOrange, ansiReset))
		a.Console.Info(fmt.Sprintf("%s3%s · chạy cả 2 (combo playtime + games played - 2 luồng)", ansiOrange, ansiReset))
		a.Console.Info(fmt.Sprintf("%s4%s · refresh auth", ansiOrange, ansiReset))
		a.Console.Info(fmt.Sprintf("%s5%s · set fingerprint", ansiOrange, ansiReset))
		a.Console.Info(fmt.Sprintf("%s6%s · exit", ansiOrange, ansiReset))
		a.Console.Rule()

		choice := strings.ToLower(a.readLine(fmt.Sprintf("  %s›%s ", ansiOrange, ansiReset)))
		fmt.Println()
		switch choice {
		case "1":
			a.ClaimGames(2, nil, nil, true)
		case "2":
			a.MarkGamesPlayed(2, nil, true)
		case "3", "c", "combo", "both":
			a.ClaimBoth(2, nil, nil, nil, true)
		case "4", "r", "refresh":
			a.refresh()
		case "5", "fp":
			a.SetFingerprint()
		case "6", "q", "exit", "":
			return
		default:
			a.Console.Warn("input", "invalid option")
		}
	}
}
