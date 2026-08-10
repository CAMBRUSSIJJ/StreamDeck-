package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"nexusdeck/companion/internal/pairing"
	"nexusdeck/companion/internal/server"
	"nexusdeck/companion/internal/store"
)

const addr = "127.0.0.1:38473"

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	s, err := store.New()
	if err != nil {
		log.Fatal(err)
	}
	devices := pairing.NewDeviceManager(s)
	defer devices.Stop()
	devices.Sync()
	pairs := pairing.NewPairManager(s, devices)
	srv := server.New(s, pairs, devices)

	go func() {
		time.Sleep(450 * time.Millisecond)
		if os.Getenv("NEXUS_NO_BROWSER") == "" {
			_ = openBrowser("http://" + addr)
		}
	}()

	go func() {
		fmt.Printf("Nexus Deck Companion v0.5.0\nPainel: http://%s\nConfig: %s\n", addr, s.Path())
		if err := srv.Listen(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
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
