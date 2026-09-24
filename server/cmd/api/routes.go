package main

import (
	"geekverse/internal/content"
	"geekverse/internal/genre"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/storage"
	"geekverse/internal/profile"
	"geekverse/internal/title"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	httpSwagger "github.com/swaggo/http-swagger/v2"
	"gorm.io/gorm"
)

func setupRoutes(db *gorm.DB, storageClient *storage.Client) *chi.Mux {
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

	r.Get("/swagger/*", httpSwagger.WrapHandler)
	r.Get("/", httperr.Wrap(func(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
		return map[string]string{
			"status":  "sucesso",
			"projeto": "GeekVerse - EXPOCEEP",
		}, http.StatusOK, nil
	}))

	titleStore := title.NewStore(db)
	titleHandler := title.NewHandler(titleStore)
	r.Mount("/titles", titleHandler.Routes())

	contentStore := content.NewStore(db)
	contentHandler := content.NewHandler(contentStore)
	r.Mount("/titles/{title_id}/contents", contentHandler.TitleRoutes())
	r.Mount("/contents", contentHandler.Routes())

	storageHandler := storage.NewHandler(storageClient)
	r.Mount("/upload", storageHandler.Routes())

	genreStore := genre.NewStore(db)
	genreHandler := genre.NewHandler(genreStore)
	r.Mount("/genres", genreHandler.Routes())

	profileStore := profile.NewStore(db)
	profileHandler := profile.NewHandler(profileStore)
	r.Mount("/profiles", profileHandler.Routes())

	return r
}
