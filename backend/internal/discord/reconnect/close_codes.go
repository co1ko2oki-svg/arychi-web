package reconnect

import "fmt"

const (
	CloseUnknownError         = 4000
	CloseUnknownOpcode        = 4001
	CloseDecodeError          = 4002
	CloseNotAuthenticated     = 4003
	CloseAuthenticationFailed = 4004
	CloseAlreadyAuthenticated = 4005
	CloseInvalidSeq           = 4007
	CloseRateLimited          = 4008
	CloseSessionTimedOut      = 4009
	CloseInvalidShard         = 4010
	CloseShardingRequired     = 4011
	CloseInvalidAPIVersion    = 4012
	CloseInvalidIntent        = 4013
	CloseDisallowedIntent     = 4014
	CloseDisallowedIntents    = 4014
)

const (
	VoiceCloseUnknownOpcode         = 4001
	VoiceCloseDecodeError           = 4002
	VoiceCloseNotAuthenticated      = 4003
	VoiceCloseAuthenticationFailed  = 4004
	VoiceCloseAlreadyAuthenticated  = 4005
	VoiceCloseSessionNoLongerValid  = 4006
	VoiceCloseSessionTimeout        = 4009
	VoiceCloseServerNotFound        = 4011
	VoiceCloseUnknownProtocol       = 4012
	VoiceCloseDisconnected          = 4014
	VoiceCloseVoiceServerCrashed    = 4015
	VoiceCloseUnknownEncryptionMode = 4016
	VoiceCloseBadRequest            = 4020
)

type CloseAction struct {
	Code               int
	Reason             string
	CanReconnect       bool
	ShouldClearSession bool
	ShouldReconnect    bool
	CanResume          bool
	Fatal              bool
}

func newCloseAction(code int, reason string, canReconnect, shouldClearSession bool) CloseAction {
	return CloseAction{
		Code:               code,
		Reason:             reason,
		CanReconnect:       canReconnect,
		ShouldClearSession: shouldClearSession,
		ShouldReconnect:    canReconnect,
		CanResume:          canReconnect && !shouldClearSession,
		Fatal:              !canReconnect,
	}
}

func ClassifyGatewayCloseCode(code int) CloseAction {
	switch code {
	case CloseAuthenticationFailed:
		return newCloseAction(code, "Authentication failed", false, true)
	case CloseInvalidShard:
		return newCloseAction(code, "Invalid shard", false, true)
	case CloseShardingRequired:
		return newCloseAction(code, "Sharding required", false, true)
	case CloseInvalidAPIVersion:
		return newCloseAction(code, "Invalid API version", false, true)
	case CloseInvalidIntent:
		return newCloseAction(code, "Invalid intent(s)", false, true)
	case CloseDisallowedIntent:
		return newCloseAction(code, "Disallowed intent(s)", false, true)
	case CloseNotAuthenticated:
		return newCloseAction(code, "Not authenticated", false, true)
	case CloseInvalidSeq:
		return newCloseAction(code, "Invalid sequence number", true, true)
	case CloseSessionTimedOut:
		return newCloseAction(code, "Session timed out", true, true)
	case CloseUnknownError:
		return newCloseAction(code, "Unknown error", true, false)
	case CloseUnknownOpcode:
		return newCloseAction(code, "Unknown opcode", true, false)
	case CloseDecodeError:
		return newCloseAction(code, "Decode error", true, false)
	case CloseAlreadyAuthenticated:
		return newCloseAction(code, "Already authenticated", true, false)
	case CloseRateLimited:
		return newCloseAction(code, "Rate limited", true, false)
	default:
		if code >= 4000 && code < 5000 {
			return newCloseAction(code, fmt.Sprintf("Gateway close %d", code), true, false)
		}
		return newCloseAction(code, fmt.Sprintf("WebSocket close %d", code), true, false)
	}
}

func ClassifyVoiceCloseCode(code int) CloseAction {
	switch code {
	case VoiceCloseVoiceServerCrashed:
		return newCloseAction(code, "Voice server crashed", true, false)
	case VoiceCloseSessionNoLongerValid, VoiceCloseSessionTimeout:
		return newCloseAction(code, "Voice session expired", true, true)
	case VoiceCloseAuthenticationFailed, VoiceCloseDisconnected, VoiceCloseServerNotFound, VoiceCloseUnknownProtocol, VoiceCloseUnknownEncryptionMode, VoiceCloseBadRequest:
		return newCloseAction(code, fmt.Sprintf("Voice close %d", code), false, true)
	default:
		if code < 4000 {
			return newCloseAction(code, "Transient voice disconnect", true, false)
		}
		return newCloseAction(code, fmt.Sprintf("Voice close %d", code), false, true)
	}
}
