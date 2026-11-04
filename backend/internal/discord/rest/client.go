package rest

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"arychi-web/backend/internal/utils"
	"github.com/google/uuid"
)

const (
	DiscordAPIBaseV10 = "https://discord.com/api/v10"
	DiscordAPIBaseV9  = "https://discord.com/api/v9"

	DesktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9236 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36"
	AndroidUserAgent = "Discord-Android/316011;RNA"
)

var (
	buildNumMu            sync.RWMutex
	cachedBuildNumber     = 539951
	buildNumberFetchedAt  time.Time
	buildNumberSingleLock sync.Mutex
	superPropsMu          sync.RWMutex

	// Shared, highly optimized connection pool for all Discord REST communication
	sharedTransport = &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 30,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		DisableCompression: false,
		ForceAttemptHTTP2:   true,
	}
	sharedHTTPClient = &http.Client{
		Transport: sharedTransport,
		Timeout:   30 * time.Second,
	}
)

func cloneMap(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return nil
	}
	dst := make(map[string]interface{}, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func GetClientBuildNumber() int {
	buildNumMu.RLock()
	defer buildNumMu.RUnlock()
	return cachedBuildNumber
}

func SetClientBuildNumber(val int) {
	buildNumMu.Lock()
	cachedBuildNumber = val
	buildNumberFetchedAt = time.Now()
	buildNumMu.Unlock()
}

func CreateDesktopProperties() map[string]interface{} {
	return map[string]interface{}{
		"os":                          "Windows",
		"browser":                     "Discord Client",
		"release_channel":             "stable",
		"client_version":              "1.0.9236",
		"os_version":                  "10.0.19045",
		"os_arch":                     "x64",
		"app_arch":                    "x64",
		"system_locale":               "en-US",
		"has_client_mods":             false,
		"client_launch_id":            uuid.NewString(),
		"browser_user_agent":          DesktopUserAgent,
		"browser_version":             "37.6.0",
		"os_sdk_version":              "19045",
		"client_build_number":         GetClientBuildNumber(),
		"native_build_number":         81687,
		"client_event_source":         nil,
		"launch_signature":            uuid.NewString(),
		"client_heartbeat_session_id": uuid.NewString(),
		"client_app_state":            "focused",
	}
}

func CreateAndroidProperties() map[string]interface{} {
	return map[string]interface{}{
		"os":                          "Android",
		"browser":                     "Discord Android",
		"device":                      "b0q",
		"system_locale":               "en-US",
		"has_client_mods":             false,
		"client_version":              "316.11 - rn",
		"release_channel":             "googleRelease",
		"device_vendor_id":            uuid.NewString(),
		"design_id":                   2,
		"browser_user_agent":          "",
		"browser_version":             "",
		"os_version":                  "28",
		"client_build_number":         5169,
		"client_event_source":         nil,
		"client_launch_id":            uuid.NewString(),
		"launch_signature":            uuid.NewString(),
		"client_app_state":            "active",
		"client_heartbeat_session_id": uuid.NewString(),
	}
}

func EncodeSuperProperties(props map[string]interface{}) string {
	superPropsMu.Lock()
	defer superPropsMu.Unlock()
	cloned := cloneMap(props)
	raw, _ := json.Marshal(cloned)
	return base64.StdEncoding.EncodeToString(raw)
}

func MakeDesktopHeaders(withProps, withOrigin bool, customProps map[string]interface{}) http.Header {
	h := make(http.Header)
	h.Set("Accept-Language", "en-US,en;q=0.9")
	h.Set("User-Agent", DesktopUserAgent)
	if withOrigin {
		h.Set("Origin", "https://discord.com")
		h.Set("Referer", "https://discord.com/channels/@me")
	}
	h.Set("Pragma", "no-cache")
	h.Set("Priority", "u=1, i")
	h.Set("Sec-Ch-Ua", `"Not)A;Brand";v="8", "Chromium";v="138"`)
	h.Set("Sec-Ch-Ua-Mobile", "?0")
	h.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	h.Set("Sec-Fetch-Dest", "empty")
	h.Set("Sec-Fetch-Mode", "cors")
	h.Set("Sec-Fetch-Site", "same-origin")
	if withProps {
		superPropsMu.Lock()
		props := cloneMap(customProps)
		if props == nil {
			props = CreateDesktopProperties()
		} else {
			props["client_build_number"] = GetClientBuildNumber()
		}
		raw, _ := json.Marshal(props)
		encoded := base64.StdEncoding.EncodeToString(raw)
		superPropsMu.Unlock()
		h.Set("X-Super-Properties", encoded)
	}
	return h
}

func MakeAndroidHeaders(withProps bool, customProps map[string]interface{}) http.Header {
	h := make(http.Header)
	h.Set("Accept-Language", "en-US,en;q=0.9")
	h.Set("User-Agent", AndroidUserAgent)
	if withProps {
		superPropsMu.Lock()
		props := cloneMap(customProps)
		if props == nil {
			props = CreateAndroidProperties()
		}
		raw, _ := json.Marshal(props)
		encoded := base64.StdEncoding.EncodeToString(raw)
		superPropsMu.Unlock()
		h.Set("X-Super-Properties", encoded)
	}
	return h
}

func MakeHeaders(extra map[string]string, customProps map[string]interface{}) http.Header {
	isAndroid := false
	if extra != nil {
		if strings.EqualFold(extra["AndroidRequest"], "true") || strings.EqualFold(extra["androidrequest"], "true") {
			isAndroid = true
		}
	}

	var base http.Header
	if isAndroid {
		base = MakeAndroidHeaders(true, customProps)
	} else {
		base = MakeDesktopHeaders(true, true, customProps)
	}

	base.Set("Accept-Language", "en-US,en;q=0.9")
	base.Set("X-Debug-Options", "bugReporterEnabled")
	base.Set("X-Discord-Locale", "en-US")
	base.Set("X-Discord-Timezone", "Asia/Saigon")

	for k, v := range extra {
		if strings.EqualFold(k, "AndroidRequest") {
			continue
		}
		base.Set(k, v)
	}
	return base
}

var (
	scriptAssetRegex = regexp.MustCompile(`/assets/[a-zA-Z0-9_\.\-]+\.js`)
	buildNumRegex    = regexp.MustCompile(`buildNumber["\s:]+["\s]*(\d{5,7})`)
)

func UpdateLatestBuildVersion(force bool) int {
	buildNumMu.RLock()
	last := buildNumberFetchedAt
	cur := cachedBuildNumber
	buildNumMu.RUnlock()

	if !force && !last.IsZero() && time.Since(last) < time.Hour {
		return cur
	}

	buildNumberSingleLock.Lock()
	defer buildNumberSingleLock.Unlock()

	buildNumMu.RLock()
	if !force && !buildNumberFetchedAt.IsZero() && time.Since(buildNumberFetchedAt) < time.Hour {
		c := cachedBuildNumber
		buildNumMu.RUnlock()
		return c
	}
	buildNumMu.RUnlock()

	utils.AddQuestLog("info", "Fetching latest Discord build number...")
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", "https://discord.com/app", nil)
	if err != nil {
		return GetClientBuildNumber()
	}
	req.Header.Set("User-Agent", DesktopUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		utils.AddQuestLog("error", fmt.Sprintf("Error fetching build number: %v", err))
		return GetClientBuildNumber()
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		utils.AddQuestLog("warn", fmt.Sprintf("Failed to fetch Discord app page (%d)", resp.StatusCode))
		return GetClientBuildNumber()
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return GetClientBuildNumber()
	}
	scripts := scriptAssetRegex.FindAllString(string(bodyBytes), -1)
	for _, scriptPath := range scripts {
		assetURL := "https://discord.com" + scriptPath
		aReq, err := http.NewRequest("GET", assetURL, nil)
		if err != nil {
			continue
		}
		aReq.Header.Set("User-Agent", DesktopUserAgent)
		aResp, err := client.Do(aReq)
		if err != nil {
			continue
		}
		jsBytes, err := io.ReadAll(aResp.Body)
		aResp.Body.Close()
		if err != nil || aResp.StatusCode != http.StatusOK {
			continue
		}
		match := buildNumRegex.FindStringSubmatch(string(jsBytes))
		if len(match) >= 2 {
			if parsed, err := strconv.Atoi(match[1]); err == nil && parsed > 0 {
				SetClientBuildNumber(parsed)
				utils.AddQuestLog("success", fmt.Sprintf("Discord build number updated: %d", parsed))
				return parsed
			}
		}
	}

	return GetClientBuildNumber()
}

func GetAppIconURL(appID string, iconHash *string) *string {
	if appID == "" || iconHash == nil || strings.TrimSpace(*iconHash) == "" {
		return nil
	}
	hash := strings.TrimSpace(*iconHash)
	if strings.HasPrefix(hash, "http://") || strings.HasPrefix(hash, "https://") {
		return &hash
	}
	hash = strings.TrimSuffix(hash, ".png")
	hash = strings.TrimSuffix(hash, ".jpg")
	hash = strings.TrimSuffix(hash, ".webp")
	u := fmt.Sprintf("https://cdn.discordapp.com/app-icons/%s/%s.png?size=256", appID, hash)
	return &u
}

func GetQuestAssetURL(questID string, assetHash *string) *string {
	if questID == "" || assetHash == nil || strings.TrimSpace(*assetHash) == "" {
		return nil
	}
	hash := strings.TrimSpace(*assetHash)
	if strings.HasPrefix(hash, "http://") || strings.HasPrefix(hash, "https://") {
		return &hash
	}
	if strings.Contains(hash, ".") {
		u := fmt.Sprintf("https://cdn.discordapp.com/quest-assets/%s/%s", questID, hash)
		return &u
	}
	u := fmt.Sprintf("https://cdn.discordapp.com/quest-assets/%s/%s.png", questID, hash)
	return &u
}

type CaptchaError struct {
	Message          string   `json:"message"`
	CaptchaKey       []string `json:"captcha_key"`
	CaptchaSitekey   string   `json:"captcha_sitekey"`
	CaptchaService   string   `json:"captcha_service"`
	CaptchaSessionID string   `json:"captcha_session_id"`
	CaptchaRqdata    string   `json:"captcha_rqdata"`
	CaptchaRqtoken   string   `json:"captcha_rqtoken"`
}

func (e *CaptchaError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return "Captcha required"
}

type APIError struct {
	StatusCode int
	Message    string
	RawBody    map[string]interface{}
	Captcha    *CaptchaError
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("Discord API Error (%d): %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("Discord API HTTP %d", e.StatusCode)
}

type DiscordUser struct {
	ID            string  `json:"id"`
	Username      string  `json:"username"`
	GlobalName    string  `json:"global_name,omitempty"`
	Discriminator string  `json:"discriminator"`
	Avatar        *string `json:"avatar"`
	AvatarURL     *string `json:"avatarUrl"`
	Email         string  `json:"email,omitempty"`
	Bot           bool    `json:"bot,omitempty"`
	Type          string  `json:"type,omitempty"`
}

type VerifiedUser = DiscordUser

func FormatAvatarURL(id, discriminator string, avatar *string) string {
	if avatar != nil && *avatar != "" {
		return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png?size=256", id, *avatar)
	}
	idx := 0
	if d, err := strconv.Atoi(discriminator); err == nil && d > 0 {
		idx = d % 5
	} else if len(id) >= 4 {
		if tail, err := strconv.Atoi(id[len(id)-4:]); err == nil {
			idx = tail % 5
		}
	}
	return fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", idx)
}

type Client struct {
	token             string
	isBot             bool
	sessionProperties map[string]interface{}
	httpClient        *http.Client
	rateMu            sync.Mutex
	routeResetAt      map[string]time.Time
	webhookID         string
	webhookToken      string
}

func NewClient(rawToken string) *Client {
	isBot := strings.HasPrefix(strings.TrimSpace(rawToken), "Bot ")
	clean := utils.CleanToken(rawToken)
	c := &Client{
		token:             clean,
		isBot:             isBot,
		sessionProperties: CreateDesktopProperties(),
		httpClient:        sharedHTTPClient,
		routeResetAt:      make(map[string]time.Time),
	}
	c.initWebhook()
	return c
}

func (c *Client) Token() string {
	return c.token
}

func (c *Client) SessionProperties() map[string]interface{} {
	return c.sessionProperties
}

func (c *Client) initWebhook() {
	webhookURL := strings.TrimSpace(os.Getenv("WEBHOOK_URL"))
	if webhookURL == "" {
		return
	}
	cleanURL := strings.Split(webhookURL, "?")[0]
	parts := strings.Split(strings.TrimRight(cleanURL, "/"), "/")
	for i, part := range parts {
		if part == "webhooks" && i+2 < len(parts) {
			c.webhookID = parts[i+1]
			c.webhookToken = parts[i+2]
			break
		}
	}
}

func (c *Client) SendWebhookMessage(content string) {
	if c.webhookID == "" || c.webhookToken == "" {
		return
	}
	go func() {
		endpoint := fmt.Sprintf("%s/webhooks/%s/%s", DiscordAPIBaseV10, c.webhookID, c.webhookToken)
		body, _ := json.Marshal(map[string]interface{}{"content": content})
		req, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := c.httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func (c *Client) EmitQuestCompleted(questID string) {
	c.SendWebhookMessage(fmt.Sprintf("[Quest Completed!](https://discord.com/quests/%s)", questID))
}

type RequestOptions struct {
	Query   url.Values
	Body    interface{}
	Headers map[string]string
}

func (c *Client) Request(ctx context.Context, method, path string, opts *RequestOptions) ([]byte, error) {
	routeKey := method + ":" + strings.Split(path, "?")[0]

	c.rateMu.Lock()
	if resetAt, ok := c.routeResetAt[routeKey]; ok && time.Now().Before(resetAt) {
		waitDur := time.Until(resetAt)
		c.rateMu.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(waitDur):
		}
	} else {
		c.rateMu.Unlock()
	}

	fullURL := DiscordAPIBaseV10 + path
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		fullURL = path
	}
	if opts != nil && len(opts.Query) > 0 {
		sep := "?"
		if strings.Contains(fullURL, "?") {
			sep = "&"
		}
		fullURL += sep + opts.Query.Encode()
	}

	var bodyBytes []byte
	if opts != nil && opts.Body != nil {
		var err error
		bodyBytes, err = json.Marshal(opts.Body)
		if err != nil {
			return nil, err
		}
	}

	for attempt := 0; attempt < 3; attempt++ {
		var bodyReader io.Reader
		if bodyBytes != nil {
			bodyReader = bytes.NewReader(bodyBytes)
		}

		req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
		if err != nil {
			return nil, err
		}

		extraHeaders := map[string]string{}
		if opts != nil && opts.Headers != nil {
			for k, v := range opts.Headers {
				extraHeaders[k] = v
			}
		}

		headers := MakeHeaders(extraHeaders, c.sessionProperties)
		if c.isBot {
			headers.Set("Authorization", "Bot "+c.token)
		} else {
			headers.Set("Authorization", c.token)
		}
		if bodyBytes != nil {
			headers.Set("Content-Type", "application/json")
		}
		req.Header = headers

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		respBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}

		if rem := resp.Header.Get("X-RateLimit-Remaining"); rem == "0" {
			if resetAfterStr := resp.Header.Get("X-RateLimit-Reset-After"); resetAfterStr != "" {
				if secs, err := strconv.ParseFloat(resetAfterStr, 64); err == nil {
					c.rateMu.Lock()
					c.routeResetAt[routeKey] = time.Now().Add(time.Duration(secs*1000) * time.Millisecond)
					c.rateMu.Unlock()
				}
			}
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			retryMs := 1500
			var rateBody struct {
				RetryAfter float64 `json:"retry_after"`
			}
			if json.Unmarshal(respBytes, &rateBody) == nil && rateBody.RetryAfter > 0 {
				retryMs = int(rateBody.RetryAfter * 1000)
			}
			c.rateMu.Lock()
			c.routeResetAt[routeKey] = time.Now().Add(time.Duration(retryMs) * time.Millisecond)
			c.rateMu.Unlock()
			utils.AddQuestLog("warn", fmt.Sprintf("RateLimited on %s %s. Retry after: %dms", method, path, retryMs))
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(retryMs) * time.Millisecond):
				continue
			}
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			apiErr := &APIError{
				StatusCode: resp.StatusCode,
			}
			var rawMap map[string]interface{}
			if json.Unmarshal(respBytes, &rawMap) == nil {
				apiErr.RawBody = rawMap
				if msg, ok := rawMap["message"].(string); ok {
					apiErr.Message = msg
				}
				if _, hasCapKey := rawMap["captcha_key"]; hasCapKey {
					var capErr CaptchaError
					if json.Unmarshal(respBytes, &capErr) == nil && capErr.CaptchaSitekey != "" {
						apiErr.Captcha = &capErr
					}
				}
			}
			if apiErr.Message == "" {
				apiErr.Message = strings.TrimSpace(string(respBytes))
			}
			return nil, apiErr
		}

		return respBytes, nil
	}

	return nil, fmt.Errorf("request to %s %s failed after rate limit retries", method, path)
}

func (c *Client) Get(ctx context.Context, path string, opts *RequestOptions) ([]byte, error) {
	return c.Request(ctx, "GET", path, opts)
}

func (c *Client) Post(ctx context.Context, path string, opts *RequestOptions) ([]byte, error) {
	return c.Request(ctx, "POST", path, opts)
}

func (c *Client) Patch(ctx context.Context, path string, opts *RequestOptions) ([]byte, error) {
	return c.Request(ctx, "PATCH", path, opts)
}

func (c *Client) Put(ctx context.Context, path string, opts *RequestOptions) ([]byte, error) {
	return c.Request(ctx, "PUT", path, opts)
}

func (c *Client) Delete(ctx context.Context, path string, opts *RequestOptions) ([]byte, error) {
	return c.Request(ctx, "DELETE", path, opts)
}

func (c *Client) GetUserInfo(ctx context.Context) (*DiscordUser, error) {
	data, err := c.Get(ctx, "/users/@me", nil)
	if err != nil {
		return nil, err
	}
	var raw struct {
		ID            string  `json:"id"`
		Username      string  `json:"username"`
		GlobalName    string  `json:"global_name"`
		Discriminator string  `json:"discriminator"`
		Avatar        *string `json:"avatar"`
		Email         string  `json:"email"`
		Bot           bool    `json:"bot"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	if raw.ID == "" {
		return nil, fmt.Errorf("invalid user payload from Discord API")
	}
	if raw.Discriminator == "" {
		raw.Discriminator = "0000"
	}
	avatarURL := FormatAvatarURL(raw.ID, raw.Discriminator, raw.Avatar)
	return &DiscordUser{
		ID:            raw.ID,
		Username:      raw.Username,
		GlobalName:    raw.GlobalName,
		Discriminator: raw.Discriminator,
		Avatar:        raw.Avatar,
		AvatarURL:     &avatarURL,
		Email:         raw.Email,
		Bot:           raw.Bot,
	}, nil
}

func (c *Client) GetProxyTicket(ctx context.Context, applicationID string) (string, error) {
	resp, err := c.Post(ctx, fmt.Sprintf("/applications/%s/proxy-tickets", applicationID), &RequestOptions{
		Body: map[string]interface{}{},
	})
	if err != nil {
		return "", err
	}
	var parsed struct {
		Ticket string `json:"ticket"`
	}
	if err := json.Unmarshal(resp, &parsed); err != nil {
		return "", err
	}
	return parsed.Ticket, nil
}

func (c *Client) AuthorizeDiscordSays(ctx context.Context, applicationID, questID, authCode string) (token string, activityReferrer string, err error) {
	ticket, err := c.GetProxyTicket(ctx, applicationID)
	if err != nil {
		return "", "", err
	}
	refURL, _ := url.Parse(fmt.Sprintf("https://%s.discordsays.com/", applicationID))
	q := refURL.Query()
	q.Set("instance_id", "example-cl-instance")
	q.Set("platform", "desktop")
	q.Set("discord_proxy_ticket", ticket)
	refURL.RawQuery = q.Encode()
	activityReferrer = refURL.String()

	headers := MakeDesktopHeaders(false, false, nil)
	headers.Set("Content-Type", "application/json")
	headers.Set("X-Auth-Token", "")
	headers.Set("X-Discord-Quest-ID", questID)
	headers.Set("Referer", activityReferrer)

	bodyBytes, _ := json.Marshal(map[string]string{"code": authCode})
	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("https://%s.discordsays.com/.proxy/acf/authorize", applicationID), bytes.NewReader(bodyBytes))
	if err != nil {
		return "", activityReferrer, err
	}
	req.Header = headers

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", activityReferrer, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", activityReferrer, err
	}
	var data struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(respBytes, &data); err != nil || data.Token == "" {
		return "", activityReferrer, fmt.Errorf("no token returned from discordsays authorize")
	}
	return data.Token, activityReferrer, nil
}

func (c *Client) ProgressDiscordSays(ctx context.Context, applicationID, questID, token string, questTarget int, activityReferrer string) error {
	headers := MakeDesktopHeaders(false, false, nil)
	headers.Set("Content-Type", "application/json")
	headers.Set("X-Auth-Token", token)
	headers.Set("X-Discord-Quest-ID", questID)
	if activityReferrer != "" {
		headers.Set("Referer", activityReferrer)
	}

	bodyBytes, _ := json.Marshal(map[string]int{"progress": questTarget})
	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("https://%s.discordsays.com/.proxy/acf/quest/progress", applicationID), bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header = headers

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discordsays progress returned HTTP %d", resp.StatusCode)
	}
	return nil
}

type SentMessage struct {
	ID        string `json:"id"`
	ChannelID string `json:"channel_id"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type DiscordMessage = SentMessage

func (c *Client) SendMessage(channelID, content, replyToMessageID string) (*SentMessage, error) {
	return c.SendMessageWithContext(context.Background(), channelID, content, replyToMessageID)
}

func (c *Client) SendMessageWithContext(ctx context.Context, channelID, content, replyToMessageID string) (*SentMessage, error) {
	body := map[string]interface{}{
		"content": content,
	}
	if replyToMessageID != "" {
		body["message_reference"] = map[string]interface{}{
			"message_id":         replyToMessageID,
			"channel_id":         channelID,
			"fail_if_not_exists": false,
		}
	}
	resp, err := c.Post(ctx, fmt.Sprintf("/channels/%s/messages", channelID), &RequestOptions{Body: body})
	if err != nil {
		return nil, err
	}
	var msg SentMessage
	if err := json.Unmarshal(resp, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

func (c *Client) EditMessage(channelID, messageID, content string) (*SentMessage, error) {
	return c.EditMessageWithContext(context.Background(), channelID, messageID, content)
}

func (c *Client) EditMessageWithContext(ctx context.Context, channelID, messageID, content string) (*SentMessage, error) {
	resp, err := c.Patch(ctx, fmt.Sprintf("/channels/%s/messages/%s", channelID, messageID), &RequestOptions{
		Body: map[string]interface{}{"content": content},
	})
	if err != nil {
		return nil, err
	}
	var msg SentMessage
	_ = json.Unmarshal(resp, &msg)
	return &msg, nil
}

func (c *Client) DeleteMessage(channelID, messageID string) error {
	return c.DeleteMessageWithContext(context.Background(), channelID, messageID)
}

func (c *Client) DeleteMessageWithContext(ctx context.Context, channelID, messageID string) error {
	_, err := c.Delete(ctx, fmt.Sprintf("/channels/%s/messages/%s", channelID, messageID), nil)
	return err
}

func (c *Client) AddReaction(channelID, messageID, emoji string) error {
	return c.AddReactionWithContext(context.Background(), channelID, messageID, emoji)
}

func (c *Client) AddReactionWithContext(ctx context.Context, channelID, messageID, emoji string) error {
	encoded := url.PathEscape(emoji)
	_, err := c.Put(ctx, fmt.Sprintf("/channels/%s/messages/%s/reactions/%s/@me", channelID, messageID, encoded), nil)
	return err
}

func (c *Client) SendMessageWithFiles(channelID, content, replyToMessageID string, filePaths []string) (*SentMessage, error) {
	return c.SendMessageWithFilesWithContext(context.Background(), channelID, content, replyToMessageID, filePaths)
}

func (c *Client) SendMessageWithFilesWithContext(ctx context.Context, channelID, content, replyToMessageID string, filePaths []string) (*SentMessage, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	payload := map[string]interface{}{
		"content": content,
	}
	if replyToMessageID != "" {
		payload["message_reference"] = map[string]interface{}{
			"message_id":         replyToMessageID,
			"channel_id":         channelID,
			"fail_if_not_exists": false,
		}
	}
	payloadBytes, _ := json.Marshal(payload)
	_ = writer.WriteField("payload_json", string(payloadBytes))

	for i, fp := range filePaths {
		f, err := os.Open(fp)
		if err != nil {
			continue
		}
		part, err := writer.CreateFormFile(fmt.Sprintf("files[%d]", i), filepath.Base(fp))
		if err == nil {
			_, _ = io.Copy(part, f)
		}
		f.Close()
	}
	_ = writer.Close()

	fullURL := fmt.Sprintf("%s/channels/%s/messages", DiscordAPIBaseV10, channelID)
	req, err := http.NewRequestWithContext(ctx, "POST", fullURL, &buf)
	if err != nil {
		return nil, err
	}
	headers := MakeHeaders(nil, c.sessionProperties)
	if c.isBot {
		headers.Set("Authorization", "Bot "+c.token)
	} else {
		headers.Set("Authorization", c.token)
	}
	headers.Set("Content-Type", writer.FormDataContentType())
	req.Header = headers

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var msg SentMessage
	_ = json.Unmarshal(respData, &msg)
	return &msg, nil
}
