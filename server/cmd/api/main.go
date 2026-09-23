package main

import (
	"fmt"
	"geekverse/internal/content"
	"geekverse/internal/platform/database"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/title"
	"log"
	"net/http"
	"os"

	_ "geekverse/docs"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

// @title GeekVerse API
// @version 1.0
// @description API central da plataforma GeekVerse (Streaming, Leitura e Galeria de Artes).
// @BasePath /
func main() {
	_ = godotenv.Load()

	connectionString := os.Getenv("DATABASE_URL")
	db, err := database.NewDatabase(connectionString)
	if err != nil {
		log.Fatalf("Falha ao conectar no banco de dados: %v", err)
	}
	fmt.Println("Conexão com Supabase/PostgreSQL estabelecida")

	autoMigrate := os.Getenv("AUTO_MIGRATE")
	if autoMigrate == "true" {
		fmt.Println("Executando migrações")
		if err := database.Migrate(db); err != nil {
			log.Fatalf("Falha ao executar migrações: %v", err)
		}
		fmt.Println("Migrações executadas com sucesso")
	}

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

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	fmt.Printf("Servidor ouvindo em http://localhost:%s/\n", port)
	fmt.Printf("Swagger UI http://localhost:%s/swagger/index.html\n", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Erro ao iniciar o servidor: %v", err)
	}
}
