package actions

import (
	"fmt"
	"testing"
)

func TestRejectsShell(t *testing.T) {
	if err := Validate(Action{Type: "shell"}); err == nil {
		t.Fatal("shell action should be rejected")
	}
}

func TestValidMedia(t *testing.T) {
	if err := Validate(Action{Type: "media", Key: "play_pause"}); err != nil {
		t.Fatal(err)
	}
}

func TestRejectsUnsafeURLScheme(t *testing.T) {
	if err := Validate(Action{Type: "open_url", URL: "file:///C:/secret"}); err == nil {
		t.Fatal("file scheme should be rejected")
	}
}

func TestValidSystemLock(t *testing.T) {
	if err := Validate(Action{Type: "system", Key: "lock"}); err != nil {
		t.Fatal(err)
	}
}

func TestValidMacro(t *testing.T) {
	stop := true
	a := Action{Type: "macro", StopOnError: &stop, Steps: []MacroStep{
		{ID: "one", When: "always", DelayMS: 0, Action: &Action{Type: "media", Key: "play_pause"}},
		{ID: "two", When: "previous_success", DelayMS: 250, Action: &Action{Type: "system", Key: "lock"}},
	}}
	if err := Validate(a); err != nil {
		t.Fatal(err)
	}
}

func TestRejectsNestedMacro(t *testing.T) {
	inner := &Action{Type: "macro", Steps: []MacroStep{{Action: &Action{Type: "media", Key: "next"}}}}
	outer := Action{Type: "macro", Steps: []MacroStep{{Action: inner}}}
	if err := Validate(outer); err == nil {
		t.Fatal("nested macro should be rejected")
	}
}

func TestRejectsMacroDelayBudget(t *testing.T) {
	steps := make([]MacroStep, 7)
	for i := range steps {
		steps[i] = MacroStep{DelayMS: 10000, Action: &Action{Type: "media", Key: "next"}}
	}
	if err := Validate(Action{Type: "macro", Steps: steps}); err == nil {
		t.Fatal("macro over delay budget should be rejected")
	}
}

func TestMacroReportTracksConditionalSteps(t *testing.T) {
	stop := false
	a := Action{Type: "macro", StopOnError: &stop, Steps: []MacroStep{
		{ID: "first", When: "always", Action: &Action{Type: "hotkey", Keys: []string{"CTRL", "F12"}}},
		{ID: "after-failure", When: "previous_failed", Action: &Action{Type: "hotkey", Keys: []string{"ALT", "F12"}}},
		{ID: "skip-success", When: "previous_success", Action: &Action{Type: "hotkey", Keys: []string{"SHIFT", "F12"}}},
	}}
	report, err := ExecuteWithReport(a)
	if err == nil {
		t.Fatal("expected non-Windows hotkey macro to report failure")
	}
	if len(report.Steps) != 3 {
		t.Fatalf("expected 3 step results, got %d", len(report.Steps))
	}
	if report.Steps[0].OK || report.Steps[0].Skipped {
		t.Fatalf("first step should fail and execute: %+v", report.Steps[0])
	}
	if report.Steps[1].Skipped {
		t.Fatalf("previous_failed step should execute: %+v", report.Steps[1])
	}
	if !report.Steps[2].Skipped {
		t.Fatalf("previous_success step should skip after failure: %+v", report.Steps[2])
	}
}

type fakeIntegrationExecutor struct {
	calls []Action
	fail  bool
}

func (f *fakeIntegrationExecutor) ExecuteIntegration(service, command string, params map[string]any) (map[string]any, error) {
	f.calls = append(f.calls, Action{Type: "integration", Service: service, Command: command, Params: params})
	if f.fail {
		return nil, fmt.Errorf("integration failed")
	}
	return map[string]any{"service": service, "command": command}, nil
}

func TestValidIntegrationAction(t *testing.T) {
	a := Action{Type: "integration", Service: "obs", Command: "toggle_stream", Params: map[string]any{}}
	if err := Validate(a); err != nil {
		t.Fatal(err)
	}
}

func TestRejectsUnsafeIntegrationName(t *testing.T) {
	a := Action{Type: "integration", Service: "../../shell", Command: "run"}
	if err := Validate(a); err == nil {
		t.Fatal("unsafe integration service should be rejected")
	}
}

func TestIntegrationExecutionReturnsData(t *testing.T) {
	exec := &fakeIntegrationExecutor{}
	a := Action{Type: "integration", Service: "spotify", Command: "next", Params: map[string]any{}}
	report, err := ExecuteWithReport(a, exec)
	if err != nil {
		t.Fatal(err)
	}
	if !report.OK || report.Data["service"] != "spotify" || len(exec.calls) != 1 {
		t.Fatalf("unexpected report/calls: %+v %+v", report, exec.calls)
	}
}

func TestMacroCanExecuteIntegrationStep(t *testing.T) {
	exec := &fakeIntegrationExecutor{}
	a := Action{Type: "macro", Steps: []MacroStep{{
		ID: "obs", When: "always", Action: &Action{Type: "integration", Service: "obs", Command: "toggle_record", Params: map[string]any{}},
	}}}
	report, err := ExecuteWithReport(a, exec)
	if err != nil {
		t.Fatal(err)
	}
	if !report.OK || len(report.Steps) != 1 || !report.Steps[0].OK || len(exec.calls) != 1 {
		t.Fatalf("unexpected macro integration report: %+v", report)
	}
}
