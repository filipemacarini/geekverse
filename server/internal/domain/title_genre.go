package domain

type TitleGenre struct {
	TitleID uint `gorm:"primaryKey"`
	GenreID uint `gorm:"primaryKey"`

	Title Title `gorm:"foreignKey:TitleID;constraint:OnDelete:CASCADE"`
	Genre Genre `gorm:"foreignKey:GenreID;constraint:OnDelete:CASCADE"`
}
