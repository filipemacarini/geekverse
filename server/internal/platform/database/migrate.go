package database

import (
	"geekverse/internal/domain"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&domain.Profile{},
		&domain.Title{},
		&domain.Content{},
		&domain.Genre{},
		&domain.TitleGenre{},
		&domain.Art{},
		&domain.ArtLike{},
		&domain.Favorite{},
	)
}
