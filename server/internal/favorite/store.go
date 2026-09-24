package favorite

import (
	"geekverse/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) FindByProfile(profileID string) ([]domain.Favorite, error) {
	var favorites []domain.Favorite
	err := s.db.Preload("Title").
		Where("profile_id = ?", profileID).
		Order("created_at DESC").
		Find(&favorites).Error
	return favorites, err
}

func (s *Store) Create(profileID string, titleID uint) error {
	var title domain.Title
	if err := s.db.Select("id").First(&title, titleID).Error; err != nil {
		return err
	}

	favorite := domain.Favorite{
		ProfileID: profileID,
		TitleID:   titleID,
	}

	return s.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&favorite).Error
}

func (s *Store) Delete(profileID string, titleID uint) error {
	result := s.db.Delete(&domain.Favorite{}, "profile_id = ? AND title_id = ?", profileID, titleID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
