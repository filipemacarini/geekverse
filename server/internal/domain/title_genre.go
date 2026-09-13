package domain

type TitleGenre struct {
	TitleID uint `gorm:"primaryKey"`
	GenreID uint `gorm:"primaryKey"`
}
