package domain

import "time"

type Art struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	ProfileID   string    `json:"profile_id" gorm:"type:uuid;not null" validate:"required"`
	Title       string    `json:"title" gorm:"type:varchar(100);not null" validate:"required,min=2,max=100"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"type:text;not null" validate:"required,url"`
	LikesCount  int       `json:"likes_count" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}
