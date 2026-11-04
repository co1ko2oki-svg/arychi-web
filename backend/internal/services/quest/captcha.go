package quest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"arychi-web/backend/internal/discord/rest"
)

const yesCaptchaBaseURL = "https://api.yescaptcha.com"

type YesCaptchaSolver struct {
	apiKey     string
	httpClient *http.Client
}

func NewYesCaptchaSolver(apiKey string) *YesCaptchaSolver {
	return &YesCaptchaSolver{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *YesCaptchaSolver) HCaptcha(ctx context.Context, sitekey, websiteURL, userAgent, rqdata string) (string, error) {
	task := map[string]interface{}{
		"type":       "HCaptchaTaskProxyless",
		"websiteURL": websiteURL,
		"websiteKey": sitekey,
	}
	if userAgent != "" {
		task["userAgent"] = userAgent
	}
	if rqdata != "" {
		task["rqdata"] = rqdata
	}

	createBody, _ := json.Marshal(map[string]interface{}{
		"clientKey": s.apiKey,
		"task":      task,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", yesCaptchaBaseURL+"/createTask", bytes.NewReader(createBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", rest.DesktopUserAgent)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	respBytes, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	var createRes struct {
		ErrorID          int    `json:"errorId"`
		ErrorCode        string `json:"errorCode"`
		ErrorDescription string `json:"errorDescription"`
		TaskID           string `json:"taskId"`
	}
	if err := json.Unmarshal(respBytes, &createRes); err != nil {
		return "", err
	}
	if createRes.ErrorID != 0 || createRes.TaskID == "" {
		return "", fmt.Errorf("error creating captcha task: %s (%s)", createRes.ErrorCode, createRes.ErrorDescription)
	}

	pollCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	for {
		pollBody, _ := json.Marshal(map[string]interface{}{
			"clientKey": s.apiKey,
			"taskId":    createRes.TaskID,
		})
		pReq, err := http.NewRequestWithContext(pollCtx, "POST", yesCaptchaBaseURL+"/getTaskResult", bytes.NewReader(pollBody))
		if err != nil {
			return "", err
		}
		pReq.Header.Set("Content-Type", "application/json")
		pReq.Header.Set("User-Agent", rest.DesktopUserAgent)

		pResp, err := s.httpClient.Do(pReq)
		if err != nil {
			return "", err
		}
		pBytes, _ := io.ReadAll(pResp.Body)
		pResp.Body.Close()

		var pollRes struct {
			ErrorID          int    `json:"errorId"`
			ErrorCode        string `json:"errorCode"`
			ErrorDescription string `json:"errorDescription"`
			Status           string `json:"status"`
			Solution         struct {
				GRecaptchaResponse string `json:"gRecaptchaResponse"`
			} `json:"solution"`
		}
		if err := json.Unmarshal(pBytes, &pollRes); err != nil {
			return "", err
		}
		if pollRes.ErrorID != 0 {
			return "", fmt.Errorf("error polling captcha result: %s (%s)", pollRes.ErrorCode, pollRes.ErrorDescription)
		}
		if pollRes.Status == "ready" {
			return pollRes.Solution.GRecaptchaResponse, nil
		}

		select {
		case <-pollCtx.Done():
			return "", fmt.Errorf("timeout waiting for captcha task result")
		case <-time.After(3 * time.Second):
		}
	}
}

func SolveCaptcha(ctx context.Context, data *rest.CaptchaError) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("YESCAPTCHA_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("YESCAPTCHA_KEY is not configured in environment variables")
	}
	if data == nil || data.CaptchaSitekey == "" {
		return "", fmt.Errorf("invalid captcha challenge payload")
	}
	solver := NewYesCaptchaSolver(apiKey)
	return solver.HCaptcha(ctx, data.CaptchaSitekey, "https://discord.com/channels/@me", rest.DesktopUserAgent, data.CaptchaRqdata)
}
