package domain

type Genre struct {
	ID   uint   `json:"id" gorm:"primaryKey;autoIncrement"`
	Name string `json:"name" gorm:"type:varchar(50);unique;not null" validate:"required,min=2,max=50"`

	Titles []Title `json:"titles,omitempty" gorm:"many2many:title_genres"`
}
