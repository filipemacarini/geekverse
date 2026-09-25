package domain

type Title struct {
	ID              uint   `json:"id" gorm:"primaryKey;autoIncrement"`
	Name            string `json:"name" gorm:"type:varchar(150);not null" validate:"required,min=2,max=150"`
	Synopsis        string `json:"synopsis" gorm:"type:text"`
	CoverURL        string `json:"cover_url" gorm:"type:text;not null" validate:"required,url"`
	BannerURL       string `json:"banner_url" gorm:"type:text" validate:"omitempty,url"`
	Type            string `json:"type" gorm:"type:varchar(20);check:type IN ('anime', 'manga', 'novel');not null" validate:"required,oneof=anime manga novel"`
	AgeRating       string `json:"age_rating" gorm:"type:varchar(2);not null;check:age_rating IN ('L', '12', '14', '16', '18')" validate:"required,oneof=L 12 14 16 18"`
	Status          string `json:"status" gorm:"type:varchar(10);not null;default:'releasing';check: status IN ('completed', 'releasing')" validate:"required,oneof=releasing completed"`
	Source          string `json:"source" gorm:"type:text"`
	PublicationYear int    `json:"publication_year" gorm:"type:smallint;not null" validate:"required"`

	EpisodeCount int  `json:"episode_count" gorm:"->"`
	HasSub       bool `json:"has_sub" gorm:"->"`
	HasDub       bool `json:"has_dub" gorm:"->"`

	Contents []Content `json:"contents,omitempty" gorm:"foreignKey:TitleID;constraint:OnDelete:CASCADE"`
	Genres   []Genre   `json:"genres,omitempty" gorm:"many2many:title_genres;constraint:OnDelete:CASCADE"`
}
