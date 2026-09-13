package domain

type Content struct {
	ID        uint     `json:"id" gorm:"primaryKey;autoIncrement"`
	TitleID   uint     `json:"title_id" gorm:"not null" validate:"required"`
	Title     string   `json:"title" gorm:"type:varchar(150);not null" validate:"required,min=1,max=150"`
	Season    int      `json:"season" gorm:"default:1" validate:"min=1"`
	Episode   *float64 `json:"episode" gorm:"type:numeric(6,1)"`
	Language  string   `json:"language" gorm:"type:varchar(10);not null;default:'none';check:language IN ('sub', 'dub', 'none')" validate:"oneof=sub dub none"`
	SourceURL string   `json:"source_url" gorm:"type:text;not null" validate:"required,url"`
	CoverURL  string   `json:"cover_url" gorm:"type:text"`
}
