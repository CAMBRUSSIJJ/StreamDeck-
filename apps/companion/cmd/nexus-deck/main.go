package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"nexusdeck/companion/internal/integrations"
	"nexusdeck/companion/internal/localpair"
	"nexusdeck/companion/internal/localserver"
	"nexusdeck/companion/internal/pairing"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/server"
	"nexusdeck/companion/internal/store"
	"nexusdeck/companion/internal/tray"
)

const adminAddr = "127.0.0.1:38473"
const localAddr = ":38474"

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	background := hasArg("--background")

	// V1.3 is single-instance. A second launch opens the existing dashboard
	// instead of failing with an opaque port error.
	if portOpen(adminAddr) {
		if !background && os.Getenv("NEXUS_NO_BROWSER") == "" {
			_ = openBrowser("http://" + adminAddr)
		}
		return
	}

	s, err := store.New()
	if err != nil {
		log.Fatal(err)
	}
	integrationManager := integrations.NewManager(s)
	devices := pairing.NewDeviceManager(s, integrationManager)
	defer devices.Stop()
	devices.Sync()
	cloudPairs := pairing.NewPairManager(s, devices)
	localPairs := localpair.New(s)
	localURL := "http://" + bestLANAddress() + ":38474"
	admin := server.New(s, cloudPairs, localPairs, devices, integrationManager, localURL)
	localDeck := localserver.New(s, localPairs, integrationManager)

	if !background {
		go func() {
			time.Sleep(500 * time.Millisecond)
			if os.Getenv("NEXUS_NO_BROWSER") == "" {
				_ = openBrowser("http://" + adminAddr)
			}
		}()
	}

	serverErrors := make(chan error, 2)
	go func() {
		fmt.Printf("Nexus Deck Companion v%s\nPainel: http://%s\nDeck local: %s\nConfig: %s\n", protocol.AppVersion, adminAddr, localURL, s.Path())
		if err := admin.Listen(adminAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- fmt.Errorf("painel administrativo: %w", err)
		}
	}()
	go func() {
		if err := localDeck.Listen(localAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- fmt.Errorf("servidor local: %w", err)
		}
	}()

	exitRequested := make(chan struct{}, 1)
	_ = tray.Start("http://"+adminAddr, localURL, func() {
		select {
		case exitRequested <- struct{}{}:
		default:
		}
	})

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	select {
	case <-stop:
	case <-exitRequested:
	case err := <-serverErrors:
		log.Printf("Nexus Companion: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = admin.Shutdown(ctx)
	_ = localDeck.Shutdown(ctx)
}

func hasArg(value string) bool {
	for _, arg := range os.Args[1:] {
		if arg == value {
			return true
		}
	}
	return false
}

func portOpen(addr string) bool {
	conn, err := net.DialTimeout("tcp", addr, 180*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func bestLANAddress() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}
	var fallback string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.ToLower(iface.Name)
		virtual := strings.Contains(name, "virtual") || strings.Contains(name, "vethernet") || strings.Contains(name, "hyper-v") || strings.Contains(name, "docker") || strings.Contains(name, "wsl") || strings.Contains(name, "tailscale") || strings.Contains(name, "vmware") || strings.Contains(name, "virtualbox") || strings.Contains(name, "vpn")
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch value := addr.(type) {
			case *net.IPNet:
				ip = value.IP
			case *net.IPAddr:
				ip = value.IP
			}
			if ip == nil || ip.To4() == nil || ip.IsLoopback() || !ip.IsPrivate() {
				continue
			}
			if fallback == "" {
				fallback = ip.String()
			}
			if !virtual {
				return ip.String()
			}
		}
	}
	if fallback != "" {
		return fallback
	}
	return "127.0.0.1"
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}
