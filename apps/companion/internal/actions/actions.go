package actions

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type MacroStep struct {
	ID      string  `json:"id,omitempty"`
	When    string  `json:"when,omitempty"`
	DelayMS int     `json:"delayMs,omitempty"`
	Action  *Action `json:"action"`
}

type Action struct {
	Type        string         `json:"type"`
	URL         string         `json:"url,omitempty"`
	Path        string         `json:"path,omitempty"`
	Args        []string       `json:"args,omitempty"`
	Keys        []string       `json:"keys,omitempty"`
	Key         string         `json:"key,omitempty"`
	Service     string         `json:"service,omitempty"`
	Command     string         `json:"command,omitempty"`
	Params      map[string]any `json:"params,omitempty"`
	StopOnError *bool          `json:"stopOnError,omitempty"`
	Steps       []MacroStep    `json:"steps,omitempty"`
}

type CommandBody struct {
	Action Action `json:"action"`
}

type StepResult struct {
	ID         string `json:"id,omitempty"`
	Index      int    `json:"index"`
	OK         bool   `json:"ok"`
	Skipped    bool   `json:"skipped,omitempty"`
	Error      string `json:"error,omitempty"`
	DurationMS int64  `json:"durationMs"`
}

type ExecutionReport struct {
	Type       string         `json:"type"`
	OK         bool           `json:"ok"`
	StartedAt  int64          `json:"startedAt"`
	DurationMS int64          `json:"durationMs"`
	Data       map[string]any `json:"data,omitempty"`
	Steps      []StepResult   `json:"steps,omitempty"`
}

type IntegrationExecutor interface {
	ExecuteIntegration(service, command string, params map[string]any) (map[string]any, error)
}

func DecodeBody(raw json.RawMessage) (CommandBody, error) {
	var body CommandBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return body, err
	}
	return body, Validate(body.Action)
}

func Validate(a Action) error { return validateAction(a, 0) }

func validateAction(a Action, depth int) error {
	if depth > 1 {
		return errors.New("nested macros are not allowed")
	}
	switch a.Type {
	case "open_url":
		u, err := url.Parse(a.URL)
		if err != nil || u.Scheme == "" {
			return errors.New("invalid URL")
		}
		switch strings.ToLower(u.Scheme) {
		case "http", "https", "mailto", "obsidian":
		default:
			return errors.New("URL scheme not allowed")
		}
	case "launch_app":
		if strings.TrimSpace(a.Path) == "" {
			return errors.New("application path required")
		}
		if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(a.Path), ".exe") {
			return errors.New("application must be an .exe on Windows")
		}
		if len(a.Args) > 32 {
			return errors.New("too many application arguments")
		}
	case "hotkey":
		if len(a.Keys) < 1 || len(a.Keys) > 5 {
			return errors.New("hotkey must have 1-5 keys")
		}
		for _, key := range a.Keys {
			if len(key) < 1 || len(key) > 16 {
				return errors.New("invalid hotkey key")
			}
		}
	case "media":
		switch a.Key {
		case "play_pause", "next", "previous", "volume_up", "volume_down", "volume_mute":
		default:
			return errors.New("unsupported media key")
		}
	case "system":
		if a.Key != "lock" {
			return errors.New("unsupported system command")
		}
	case "integration":
		if !safeIntegrationName(a.Service) || !safeIntegrationName(a.Command) {
			return errors.New("invalid integration service or command")
		}
		raw, err := json.Marshal(a.Params)
		if err != nil || len(raw) > 16<<10 {
			return errors.New("integration parameters are invalid or too large")
		}
	case "macro":
		if len(a.Steps) < 1 || len(a.Steps) > 20 {
			return errors.New("macro must contain 1-20 steps")
		}
		totalDelay := 0
		for i, step := range a.Steps {
			if step.Action == nil {
				return fmt.Errorf("macro step %d has no action", i+1)
			}
			if step.Action.Type == "macro" {
				return errors.New("nested macros are not allowed")
			}
			if step.DelayMS < 0 || step.DelayMS > 10_000 {
				return fmt.Errorf("macro step %d has invalid delay", i+1)
			}
			totalDelay += step.DelayMS
			if totalDelay > 60_000 {
				return errors.New("macro delay budget exceeds 60 seconds")
			}
			switch step.When {
			case "", "always", "previous_success", "previous_failed":
			default:
				return fmt.Errorf("macro step %d has invalid condition", i+1)
			}
			if err := validateAction(*step.Action, depth+1); err != nil {
				return fmt.Errorf("macro step %d: %w", i+1, err)
			}
		}
	default:
		return fmt.Errorf("unsupported action type %q", a.Type)
	}
	return nil
}

func safeIntegrationName(value string) bool {
	if len(value) < 1 || len(value) > 48 {
		return false
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			continue
		}
		return false
	}
	return true
}

func stopOnError(a Action) bool {
	if a.StopOnError == nil {
		return true
	}
	return *a.StopOnError
}

func executePrimitive(a Action, integration IntegrationExecutor) (map[string]any, error) {
	switch a.Type {
	case "open_url":
		return nil, openURL(a.URL)
	case "launch_app":
		return nil, exec.Command(a.Path, a.Args...).Start()
	case "hotkey":
		return nil, sendHotkey(a.Keys)
	case "media":
		return nil, sendMediaKey(a.Key)
	case "system":
		return nil, runSystemAction(a.Key)
	case "integration":
		if integration == nil {
			return nil, errors.New("integration executor unavailable")
		}
		return integration.ExecuteIntegration(a.Service, a.Command, a.Params)
	default:
		return nil, errors.New("unsupported primitive action")
	}
}

func Execute(a Action, integration ...IntegrationExecutor) error {
	_, err := ExecuteWithReport(a, integration...)
	return err
}

func ExecuteWithReport(a Action, integrations ...IntegrationExecutor) (ExecutionReport, error) {
	started := time.Now()
	report := ExecutionReport{Type: a.Type, StartedAt: started.UnixMilli()}
	if err := Validate(a); err != nil {
		report.DurationMS = time.Since(started).Milliseconds()
		return report, err
	}
	var integration IntegrationExecutor
	if len(integrations) > 0 {
		integration = integrations[0]
	}
	if a.Type != "macro" {
		data, err := executePrimitive(a, integration)
		report.OK = err == nil
		report.Data = data
		report.DurationMS = time.Since(started).Milliseconds()
		return report, err
	}

	previousOK := true
	for index, step := range a.Steps {
		when := step.When
		if when == "" {
			when = "always"
		}
		shouldRun := when == "always" || (when == "previous_success" && previousOK) || (when == "previous_failed" && !previousOK)
		result := StepResult{ID: step.ID, Index: index, OK: false}
		if !shouldRun {
			result.Skipped = true
			report.Steps = append(report.Steps, result)
			continue
		}
		if step.DelayMS > 0 {
			time.Sleep(time.Duration(step.DelayMS) * time.Millisecond)
		}
		stepStarted := time.Now()
		_, err := executePrimitive(*step.Action, integration)
		result.DurationMS = time.Since(stepStarted).Milliseconds()
		result.OK = err == nil
		if err != nil {
			result.Error = err.Error()
		}
		report.Steps = append(report.Steps, result)
		previousOK = err == nil
		if err != nil && stopOnError(a) {
			report.OK = false
			report.DurationMS = time.Since(started).Milliseconds()
			return report, fmt.Errorf("macro stopped at step %d: %w", index+1, err)
		}
	}

	failed := false
	for _, step := range report.Steps {
		if !step.Skipped && !step.OK {
			failed = true
			break
		}
	}
	report.OK = !failed
	report.DurationMS = time.Since(started).Milliseconds()
	if failed {
		return report, errors.New("macro completed with one or more failed steps")
	}
	return report, nil
}
