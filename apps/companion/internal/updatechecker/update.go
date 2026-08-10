package updatechecker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const latestReleaseURL = "https://api.github.com/repos/CAMBRUSSIJJ/StreamDeck/releases/latest"

type Info struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl,omitempty"`
	DownloadURL     string `json:"downloadUrl,omitempty"`
	PublishedAt     string `json:"publishedAt,omitempty"`
}

type releaseResponse struct {
	TagName     string `json:"tag_name"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func Check(ctx context.Context, current string) (Info, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestReleaseURL, nil)
	if err != nil {
		return Info{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "NexusDeck-Companion/"+current)
	resp, err := client.Do(req)
	if err != nil {
		return Info{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Info{}, fmt.Errorf("GitHub respondeu %s", resp.Status)
	}
	var release releaseResponse
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return Info{}, err
	}
	latest := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")
	if latest == "" {
		return Info{}, fmt.Errorf("release sem versão")
	}
	out := Info{CurrentVersion: current, LatestVersion: latest, UpdateAvailable: Compare(latest, current) > 0, ReleaseURL: release.HTMLURL, PublishedAt: release.PublishedAt}
	for _, asset := range release.Assets {
		name := strings.ToLower(asset.Name)
		if strings.Contains(name, "nexusdeck") && strings.Contains(name, "companion") && strings.HasSuffix(name, ".exe") {
			out.DownloadURL = asset.BrowserDownloadURL
			break
		}
	}
	return out, nil
}

var semverPattern = regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)`)

func parse(v string) [3]int {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	m := semverPattern.FindStringSubmatch(v)
	var out [3]int
	if len(m) == 4 {
		for i := 0; i < 3; i++ {
			out[i], _ = strconv.Atoi(m[i+1])
		}
	}
	return out
}

func Compare(a, b string) int {
	av, bv := parse(a), parse(b)
	for i := 0; i < 3; i++ {
		if av[i] > bv[i] {
			return 1
		}
		if av[i] < bv[i] {
			return -1
		}
	}
	return 0
}
