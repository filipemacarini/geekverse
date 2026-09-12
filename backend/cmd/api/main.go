package main

import (
	"fmt"
	"geekverse/internal/platform/database"
	"geekverse/internal/platform/httperr"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	db := database.NewDatabase()
	_ = db

	r := chi.NewRouter()

	r.Use((middleware.RequestID))
	r.Use((middleware.Logger))
	r.Use((middleware.Recoverer))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/", httperr.Wrap(func(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
		return map[string]string{
			"status":  "sucesso",
			"projeto": "GeekVerse - EXPOCEEP",
		}, http.StatusOK, nil
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	fmt.Printf("Servidor ouvindo em http://localhost:%s/\n", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Erro ao iniciar o servidor: %v", err)
	}
}
