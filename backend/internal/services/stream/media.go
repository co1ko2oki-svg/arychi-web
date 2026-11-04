package stream

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/config"
	"arychi-web/backend/internal/utils"
)

type VideoParams struct {
	Width   int     `json:"width"`
	Height  int     `json:"height"`
	Bitrate string  `json:"bitrate,omitempty"`
	FPS     float64 `json:"fps"`
}

func IsValidURL(input string) bool {
	if input == "" {
		return false
	}
	return strings.Contains(input, "youtube.com/") ||
		strings.Contains(input, "youtu.be/") ||
		strings.Contains(input, "twitch.tv/") ||
		strings.HasPrefix(input, "http://") ||
		strings.HasPrefix(input, "https://")
}

func IsLocalFile(filePath string) bool {
	if filePath == "" {
		return false
	}
	if strings.HasPrefix(filePath, "http://") || strings.HasPrefix(filePath, "https://") {
		return false
	}
	info, err := os.Stat(filePath)
	return err == nil && !info.IsDir()
}

func GetFFmpegExecutablePath() string {
	root := config.ResolveWorkspaceRoot()
	binName := "ffmpeg"
	if runtime.GOOS == "windows" {
		binName = "ffmpeg.exe"
	}

	candidates := []string{
		filepath.Join(root, "stream", "node_modules", "node-av", "binary", binName),
		filepath.Join(root, "node_modules", "node-av", "binary", binName),
		filepath.Join(root, "stream", "scripts", binName),
		filepath.Join(root, "scripts", binName),
	}

	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c
		}
	}

	if sysPath, err := exec.LookPath(binName); err == nil {
		return sysPath
	}
	return ""
}

func GetFFprobeExecutablePath() string {
	root := config.ResolveWorkspaceRoot()
	binName := "ffprobe"
	if runtime.GOOS == "windows" {
		binName = "ffprobe.exe"
	}

	candidates := []string{
		filepath.Join(root, "stream", "node_modules", "node-av", "binary", binName),
		filepath.Join(root, "node_modules", "node-av", "binary", binName),
		filepath.Join(root, "stream", "scripts", binName),
		filepath.Join(root, "scripts", binName),
	}

	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c
		}
	}

	if sysPath, err := exec.LookPath(binName); err == nil {
		return sysPath
	}
	return ""
}

var (
	screenshotMu      sync.Mutex
	activeScreenshots = make(map[string]chan struct{})
)

func FFmpegScreenshot(videosDir, previewCacheDir, videoFilename string) ([]string, error) {
	screenshotMu.Lock()
	if waitCh, exists := activeScreenshots[videoFilename]; exists {
		screenshotMu.Unlock()
		<-waitCh
		var existing []string
		for i := 1; i <= 5; i++ {
			p := filepath.Join(previewCacheDir, fmt.Sprintf("%s-%d.jpg", videoFilename, i))
			if _, err := os.Stat(p); err == nil {
				existing = append(existing, p)
			}
		}
		return existing, nil
	}
	doneCh := make(chan struct{})
	activeScreenshots[videoFilename] = doneCh
	screenshotMu.Unlock()

	defer func() {
		screenshotMu.Lock()
		delete(activeScreenshots, videoFilename)
		close(doneCh)
		screenshotMu.Unlock()
	}()

	_ = os.MkdirAll(previewCacheDir, 0755)
	inputPath := filepath.Join(videosDir, videoFilename)
	ffmpegBin := GetFFmpegExecutablePath()
	if ffmpegBin == "" {
		return nil, fmt.Errorf("ffmpeg executable not found")
	}

	durationSec := probeDurationSeconds(inputPath, ffmpegBin)
	if durationSec <= 0 {
		durationSec = 10.0
	}

	percents := []float64{0.10, 0.30, 0.50, 0.70, 0.90}
	var images []string

	for idx, pct := range percents {
		ts := durationSec * pct
		outFilename := fmt.Sprintf("%s-%d.jpg", videoFilename, idx+1)
		outPath := filepath.Join(previewCacheDir, outFilename)

		cmd := exec.Command(
			ffmpegBin,
			"-y",
			"-ss", fmt.Sprintf("%.2f", ts),
			"-i", inputPath,
			"-frames:v", "1",
			"-q:v", "2",
			outPath,
		)
		if err := cmd.Run(); err != nil {
			// Fallback to 0s if timestamp exceeded duration
			fallbackCmd := exec.Command(
				ffmpegBin,
				"-y",
				"-ss", "0",
				"-i", inputPath,
				"-frames:v", "1",
				"-q:v", "2",
				outPath,
			)
			if err2 := fallbackCmd.Run(); err2 != nil {
				return nil, err
			}
		}
		images = append(images, outPath)
	}

	return images, nil
}

func probeDurationSeconds(videoPath, ffmpegBin string) float64 {
	cmd := exec.Command(ffmpegBin, "-i", videoPath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()

	out := stderr.String()
	re := regexp.MustCompile(`Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)`)
	matches := re.FindStringSubmatch(out)
	if len(matches) == 4 {
		h, _ := strconv.ParseFloat(matches[1], 64)
		m, _ := strconv.ParseFloat(matches[2], 64)
		s, _ := strconv.ParseFloat(matches[3], 64)
		return h*3600 + m*60 + s
	}
	return 0
}

func GetVideoParams(videoPath string) (*VideoParams, error) {
	ffprobeBin := GetFFprobeExecutablePath()
	if ffprobeBin != "" {
		cmd := exec.Command(ffprobeBin, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", videoPath)
		out, err := cmd.Output()
		if err == nil {
			var meta struct {
				Streams []struct {
					CodecType    string `json:"codec_type"`
					Width        int    `json:"width"`
					Height       int    `json:"height"`
					RFrameRate   string `json:"r_frame_rate"`
					AvgFrameRate string `json:"avg_frame_rate"`
					BitRate      string `json:"bit_rate"`
				} `json:"streams"`
				Format struct {
					BitRate string `json:"bit_rate"`
				} `json:"format"`
			}
			if json.Unmarshal(out, &meta) == nil {
				for _, s := range meta.Streams {
					if s.CodecType == "video" && s.Width > 0 && s.Height > 0 {
						fps := parseFrameRate(s.RFrameRate)
						if fps == 0 {
							fps = parseFrameRate(s.AvgFrameRate)
						}
						br := s.BitRate
						if br == "" {
							br = meta.Format.BitRate
						}
						return &VideoParams{
							Width:   s.Width,
							Height:  s.Height,
							Bitrate: br,
							FPS:     fps,
						}, nil
					}
				}
			}
		}
	}

	// Fallback to parsing `ffmpeg -i` stderr when ffprobe is not bundled
	ffmpegBin := GetFFmpegExecutablePath()
	if ffmpegBin == "" {
		return nil, fmt.Errorf("Unable to determine video stream dimensions.")
	}
	cmd := exec.Command(ffmpegBin, "-i", videoPath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()
	infoStr := stderr.String()

	resRe := regexp.MustCompile(`Stream #.*Video:.*?,\s*(\d{2,5})x(\d{2,5})`)
	resMatch := resRe.FindStringSubmatch(infoStr)
	if len(resMatch) < 3 {
		return nil, fmt.Errorf("Unable to determine video stream dimensions.")
	}
	w, _ := strconv.Atoi(resMatch[1])
	h, _ := strconv.Atoi(resMatch[2])

	var fps float64
	fpsRe := regexp.MustCompile(`(\d+(?:\.\d+)?)\s*fps`)
	if fpsMatch := fpsRe.FindStringSubmatch(infoStr); len(fpsMatch) >= 2 {
		fps, _ = strconv.ParseFloat(fpsMatch[1], 64)
	}

	var bitrate string
	brRe := regexp.MustCompile(`bitrate:\s*(\d+)\s*kb/s`)
	if brMatch := brRe.FindStringSubmatch(infoStr); len(brMatch) >= 2 {
		if kbps, err := strconv.Atoi(brMatch[1]); err == nil {
			bitrate = strconv.Itoa(kbps * 1000)
		}
	}

	return &VideoParams{
		Width:   w,
		Height:  h,
		Bitrate: bitrate,
		FPS:     fps,
	}, nil
}

func parseFrameRate(fr string) float64 {
	if fr == "" {
		return 0
	}
	parts := strings.Split(fr, "/")
	if len(parts) == 2 {
		num, err1 := strconv.ParseFloat(parts[0], 64)
		den, err2 := strconv.ParseFloat(parts[1], 64)
		if err1 == nil && err2 == nil && den != 0 {
			return num / den
		}
	}
	val, _ := strconv.ParseFloat(fr, 64)
	return val
}

func getYtDlpBinaryName() string {
	switch runtime.GOOS {
	case "windows":
		if runtime.GOARCH == "386" {
			return "yt-dlp_x86.exe"
		}
		return "yt-dlp.exe"
	case "darwin":
		return "yt-dlp_macos"
	case "linux":
		if runtime.GOARCH == "arm64" {
			return "yt-dlp_linux_aarch64"
		}
		if runtime.GOARCH == "arm" {
			return "yt-dlp_linux_armv7l"
		}
		return "yt-dlp"
	default:
		return "yt-dlp"
	}
}

func GetYtDlpExecutablePath() string {
	root := config.ResolveWorkspaceRoot()
	binName := getYtDlpBinaryName()

	candidates := []string{
		filepath.Join(root, "bin", binName),
		filepath.Join(root, "scripts", binName),
		filepath.Join(root, "stream", "scripts", binName),
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c
		}
	}
	return candidates[0]
}

func DownloadYtDlpExecutable() error {
	exePath := GetYtDlpExecutablePath()
	if info, err := os.Stat(exePath); err == nil && !info.IsDir() {
		return nil
	}

	utils.StreamLogs.Info("yt-dlp not found, downloading latest release...")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var releases []struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil || len(releases) == 0 {
		return fmt.Errorf("Failed to fetch yt-dlp release information from GitHub.")
	}

	release := releases[0]
	binName := getYtDlpBinaryName()
	var downloadURL string
	for _, asset := range release.Assets {
		if asset.Name == binName {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}
	if downloadURL == "" {
		return fmt.Errorf("Could not find suitable binary asset %q in release %s.", binName, release.TagName)
	}

	dlResp, err := client.Get(downloadURL)
	if err != nil {
		return err
	}
	defer dlResp.Body.Close()

	_ = os.MkdirAll(filepath.Dir(exePath), 0755)
	data, err := io.ReadAll(dlResp.Body)
	if err != nil {
		return err
	}
	if err := os.WriteFile(exePath, data, 0777); err != nil {
		return err
	}

	utils.StreamLogs.Info("yt-dlp %s downloaded successfully.", release.TagName)
	return nil
}

func CheckForUpdatesAndUpdateYtDlp() {
	if err := DownloadYtDlpExecutable(); err != nil {
		utils.StreamLogs.Error("Error during yt-dlp update check: %v", err)
		return
	}
	exePath := GetYtDlpExecutablePath()
	cmd := exec.Command(exePath, "--update")
	out, err := cmd.CombinedOutput()
	outStr := strings.TrimSpace(string(out))
	if err == nil && strings.Contains(outStr, "Updated yt-dlp to") {
		utils.StreamLogs.Info("yt-dlp updated successfully: %s", outStr)
	}
}

func buildYtDlpArgs(target string, cookiesPath string, extraArgs ...string) []string {
	var args []string
	args = append(args, target)
	if cookiesPath != "" {
		if _, err := os.Stat(cookiesPath); err == nil {
			args = append(args, "--cookies", cookiesPath)
		}
	}
	if ffmpegBin := GetFFmpegExecutablePath(); ffmpegBin != "" {
		args = append(args, "--ffmpeg-location", ffmpegBin)
	}
	args = append(args, extraArgs...)
	return args
}

func ExecYtDlpCommand(target string, cookiesPath string, extraArgs ...string) *exec.Cmd {
	exePath := GetYtDlpExecutablePath()
	args := buildYtDlpArgs(target, cookiesPath, extraArgs...)
	return exec.Command(exePath, args...)
}

type ytResponse struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	WebpageURL string `json:"webpage_url"`
	URL        string `json:"url"`
	IsLive     bool   `json:"is_live"`
	LiveStatus string `json:"live_status"`
	Formats    []struct {
		URL    string  `json:"url"`
		Ext    string  `json:"ext"`
		VCodec string  `json:"vcodec"`
		ACodec string  `json:"acodec"`
		Height float64 `json:"height"`
	} `json:"formats"`
	Entries []ytResponse `json:"entries"`
}

type MediaService struct {
	cfg *config.StreamConfig
}

func NewMediaService(cfg *config.StreamConfig) *MediaService {
	return &MediaService{cfg: cfg}
}

func (m *MediaService) ResolveMediaSource(input string) *MediaSource {
	if strings.Contains(input, "youtube.com/") || strings.Contains(input, "youtu.be/") {
		return m.resolveYouTubeSource(input)
	}
	if strings.Contains(input, "twitch.tv/") {
		return m.resolveTwitchSource(input)
	}
	if IsLocalFile(input) {
		return m.resolveLocalSource(input)
	}
	if IsValidURL(input) {
		return m.resolveDirectURLSource(input)
	}
	return m.SearchAndPlayYouTube(input)
}

func (m *MediaService) resolveYouTubeSource(targetURL string) *MediaSource {
	info := m.getYouTubeVideoInfo(targetURL)
	if info == nil {
		return nil
	}
	isLive := info.IsLive || info.LiveStatus == "is_live"
	streamURL := targetURL
	if isLive {
		liveURL := m.getLiveStreamURL(targetURL)
		if liveURL == "" {
			return nil
		}
		streamURL = liveURL
	}
	return &MediaSource{
		URL:    streamURL,
		Title:  info.Title,
		Type:   "youtube",
		IsLive: isLive,
	}
}

func (m *MediaService) getYouTubeVideoInfo(targetURL string) *ytResponse {
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	cmd := ExecYtDlpCommand(targetURL, cookies, "--dump-single-json", "--no-playlist")
	out, err := cmd.Output()
	if err != nil {
		utils.StreamLogs.Error("Failed to get video info using yt-dlp for URL %s: %v", targetURL, err)
		return nil
	}
	var data ytResponse
	if err := json.Unmarshal(out, &data); err != nil || data.ID == "" || data.Title == "" {
		utils.StreamLogs.Warn("Failed to parse video info from yt-dlp for URL: %s", targetURL)
		return nil
	}
	return &data
}

func (m *MediaService) getLiveStreamURL(youtubePageURL string) string {
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	cmd := ExecYtDlpCommand(
		youtubePageURL,
		cookies,
		"--get-url",
		"--format", "best[protocol=https]/best[protocol=http]/best",
		"--no-playlist",
		"--quiet",
	)
	out, err := cmd.Output()
	if err != nil {
		utils.StreamLogs.Error("Failed to get live stream URL using yt-dlp for %s: %v", youtubePageURL, err)
		return ""
	}
	streamURL := strings.TrimSpace(string(out))
	if streamURL != "" {
		utils.StreamLogs.Info("Resolved live stream URL for %s", youtubePageURL)
		return streamURL
	}
	utils.StreamLogs.Warn("yt-dlp did not return a valid live stream URL for: %s", youtubePageURL)
	return ""
}

func (m *MediaService) GetTwitchStreamURL(targetURL string) string {
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	cmd := ExecYtDlpCommand(targetURL, cookies, "--get-url", "--quiet")
	out, err := cmd.Output()
	if err != nil {
		utils.StreamLogs.Error("Failed to get Twitch stream URL: %v", err)
		return ""
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) > 0 && strings.TrimSpace(lines[0]) != "" {
		return strings.TrimSpace(lines[0])
	}
	return ""
}

func (m *MediaService) resolveTwitchSource(targetURL string) *MediaSource {
	streamURL := m.GetTwitchStreamURL(targetURL)
	if streamURL == "" {
		return nil
	}
	parts := strings.Split(strings.TrimRight(targetURL, "/"), "/")
	twitchID := parts[len(parts)-1]
	return &MediaSource{
		URL:   streamURL,
		Title: fmt.Sprintf("twitch.tv/%s", twitchID),
		Type:  "twitch",
	}
}

func (m *MediaService) resolveLocalSource(filePath string) *MediaSource {
	ext := filepath.Ext(filePath)
	base := filepath.Base(filePath)
	title := strings.TrimSuffix(base, ext)
	return &MediaSource{
		URL:   filePath,
		Title: title,
		Type:  "local",
	}
}

func (m *MediaService) resolveDirectURLSource(targetURL string) *MediaSource {
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	cmd := ExecYtDlpCommand(targetURL, cookies, "--dump-json", "--skip-download", "--no-warnings", "--quiet")
	if out, err := cmd.Output(); err == nil {
		var meta ytResponse
		if json.Unmarshal(out, &meta) == nil && meta.Title != "" {
			streamURL := targetURL
			type candidate struct {
				url   string
				score float64
			}
			var candidates []candidate
			for _, f := range meta.Formats {
				if f.URL != "" && f.Ext != "m3u8" {
					score := f.Height / 1000.0
					if f.VCodec != "" && f.VCodec != "none" {
						score += 1.0
					}
					if f.ACodec != "" && f.ACodec != "none" {
						score += 1.0
					}
					candidates = append(candidates, candidate{url: f.URL, score: score})
				}
			}
			if len(candidates) > 0 {
				sort.Slice(candidates, func(i, j int) bool {
					return candidates[i].score > candidates[j].score
				})
				streamURL = candidates[0].url
			}
			return &MediaSource{
				URL:   streamURL,
				Title: meta.Title,
				Type:  "url",
			}
		}
	}

	title := "Direct URL"
	if parsed, err := url.Parse(targetURL); err == nil {
		segments := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(segments) > 0 && segments[len(segments)-1] != "" {
			last := segments[len(segments)-1]
			if decoded, err := url.PathUnescape(last); err == nil {
				last = decoded
			}
			if idx := strings.LastIndex(last, "."); idx > 0 {
				title = last[:idx]
			} else {
				title = last
			}
		}
	}

	return &MediaSource{
		URL:   targetURL,
		Title: title,
		Type:  "url",
	}
}

func (m *MediaService) DownloadYouTubeVideo(targetURL string) string {
	_ = DownloadYtDlpExecutable()

	videoIDRe := regexp.MustCompile(`(?:v=|youtu\.be/)([^&?/]+)`)
	match := videoIDRe.FindStringSubmatch(targetURL)
	var videoID string
	if len(match) >= 2 {
		videoID = match[1]
	} else {
		b := make([]byte, 6)
		_, _ = rand.Read(b)
		videoID = hex.EncodeToString(b)
	}

	videosDir := "./videos"
	maxHeight := 720
	cookies := ""
	if m.cfg != nil {
		if m.cfg.VideosDir != "" {
			videosDir = m.cfg.VideosDir
		}
		if m.cfg.Height > 0 {
			maxHeight = m.cfg.Height
		}
		cookies = m.cfg.YtdlpCookiesPath
	}

	_ = os.MkdirAll(videosDir, 0755)
	cachedFilePath := filepath.Join(videosDir, fmt.Sprintf("%s.mp4", videoID))
	if info, err := os.Stat(cachedFilePath); err == nil && !info.IsDir() {
		utils.StreamLogs.Info("Found cached video: %s", cachedFilePath)
		return cachedFilePath
	}

	formatSpec := fmt.Sprintf(
		"bestvideo[height<=%d][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=%d]+bestaudio/best[height<=%d]/best",
		maxHeight, maxHeight, maxHeight,
	)

	cmd := ExecYtDlpCommand(
		targetURL,
		cookies,
		"--format", formatSpec,
		"--no-playlist",
		"--concurrent-fragments", "5",
		"--output", cachedFilePath,
		"--quiet",
		"--no-warnings",
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		_ = os.Remove(cachedFilePath)
		utils.StreamLogs.Error("Failed to download YouTube video: %v (%s)", err, strings.TrimSpace(stderr.String()))
		return ""
	}
	if _, err := os.Stat(cachedFilePath); err != nil {
		return ""
	}
	return cachedFilePath
}

func (m *MediaService) SearchYouTube(query string, limit int) []string {
	if limit <= 0 {
		limit = 5
	}
	_ = DownloadYtDlpExecutable()
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	searchSpec := fmt.Sprintf("ytsearch%d:%s", limit, query)
	cmd := ExecYtDlpCommand(searchSpec, cookies, "--flat-playlist", "--dump-single-json", "--no-warnings", "--quiet")
	out, err := cmd.Output()
	if err != nil {
		utils.StreamLogs.Warn("No videos found with query: %q", query)
		return []string{}
	}
	var res ytResponse
	if err := json.Unmarshal(out, &res); err != nil || len(res.Entries) == 0 {
		return []string{}
	}
	var formatted []string
	for i, entry := range res.Entries {
		formatted = append(formatted, fmt.Sprintf("%d. `%s`", i+1, entry.Title))
	}
	return formatted
}

func (m *MediaService) SearchAndPlayYouTube(query string) *MediaSource {
	_ = DownloadYtDlpExecutable()
	cookies := ""
	if m.cfg != nil {
		cookies = m.cfg.YtdlpCookiesPath
	}
	searchSpec := fmt.Sprintf("ytsearch1:%s", query)
	cmd := ExecYtDlpCommand(searchSpec, cookies, "--flat-playlist", "--dump-single-json", "--no-warnings", "--quiet")
	out, err := cmd.Output()
	if err != nil {
		utils.StreamLogs.Warn("No video found on YouTube for title: %q", query)
		return nil
	}
	var res ytResponse
	if err := json.Unmarshal(out, &res); err != nil || len(res.Entries) == 0 {
		return nil
	}
	first := res.Entries[0]
	pageURL := first.URL
	if first.WebpageURL != "" {
		pageURL = first.WebpageURL
	} else if pageURL == "" && first.ID != "" {
		pageURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", first.ID)
	}
	if pageURL == "" || first.Title == "" {
		return nil
	}
	return &MediaSource{
		URL:   pageURL,
		Title: first.Title,
		Type:  "youtube",
	}
}
