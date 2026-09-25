package domain

import "time"

type ArtLike struct {
	ProfileID string    `gorm:"type:uuid;primaryKey"`
	ArtID     uint      `gorm:"primaryKey"`
	CreatedAt time.Time `gorm:"autoCreateTime"`

	Profile Profile `gorm:"foreignKey:ProfileID;constraint:OnDelete:CASCADE"`
	Art     Art     `gorm:"foreignKey:ArtID;constraint:OnDelete:CASCADE"`
}
