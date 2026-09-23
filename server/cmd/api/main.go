package main

import (
	"fmt"
	"geekverse/internal/platform/database"
	"geekverse/internal/platform/storage"
	"log"
	"net/http"
	"os"

	_ "geekverse/docs"

	"github.com/joho/godotenv"
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

	storageClient := storage.NewClient(
		os.Getenv("SUPABASE_URL"),
		os.Getenv("SUPABASE_KEY"),
	)

	r := setupRoutes(db, storageClient)

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
