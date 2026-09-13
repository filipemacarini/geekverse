package database

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewDatabase() *gorm.DB {
	cs := os.Getenv("DATABASE_URL")
	if cs == "" {
		log.Fatal("DATABASE_URL não configurada no arquivo .env")
	}

	db, err := gorm.Open(postgres.Open(cs), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Falha ao conectar no Supabase/Postgres: %v", err)
	}

	fmt.Println("Conexão com Supabase/PostgreSQL estabelecida")
	return db
}
