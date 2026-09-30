package main

import (
	"geekverse/internal/art"
	"geekverse/internal/content"
	"geekverse/internal/favorite"
	"geekverse/internal/genre"
	"geekverse/internal/platform/auth"
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

func setupRoutes(db *gorm.DB, storageClient *storage.Client, authValidator *auth.Validator) *chi.Mux {
	requireAuth := auth.RequireAuth(db, authValidator)
	requireAdmin := auth.RequireRole("admin")
	requireContentStaff := auth.RequireRole("admin", "content_manager")

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
	r.Mount("/upload", storageHandler.Routes(requireAuth, requireContentStaff))

	genreStore := genre.NewStore(db)
	genreHandler := genre.NewHandler(genreStore)
	r.Mount("/genres", genreHandler.Routes())

	profileStore := profile.NewStore(db)
	profileHandler := profile.NewHandler(profileStore)
	r.Mount("/profiles", profileHandler.Routes(requireAuth, requireAdmin))

	favoriteStore := favorite.NewStore(db)
	favoriteHandler := favorite.NewHandler(favoriteStore)
	r.Mount("/favorites", favoriteHandler.Routes(requireAuth))
	r.Mount("/profiles/{id}/favorites", favoriteHandler.PublicRoutes())

	artStore := art.NewStore(db)
	artHandler := art.NewHandler(artStore)
	r.Mount("/arts", artHandler.Routes(requireAuth))

	return r
}
