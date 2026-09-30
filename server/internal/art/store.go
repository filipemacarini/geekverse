package art

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

func (s *Store) FindAll(q string, page, limit int) ([]domain.Art, int64, error) {
	var arts []domain.Art
	var total int64

	query := s.db.Model(&domain.Art{})

	if q != "" {
		query = query.Where("title ILIKE ?", "%"+q+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := query.Preload("Profile").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&arts).Error

	return arts, total, err
}

func (s *Store) FindByID(id uint) (*domain.Art, error) {
	var art domain.Art
	err := s.db.Preload("Profile").First(&art, id).Error
	if err != nil {
		return nil, err
	}
	return &art, nil
}

func (s *Store) Create(art *domain.Art) error {
	var profile domain.Profile
	if err := s.db.Select("id").First(&profile, "id = ?", art.ProfileID).Error; err != nil {
		return err
	}
	return s.db.Create(art).Error
}

func (s *Store) Update(id uint, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	result := s.db.Model(&domain.Art{ID: id}).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) Delete(id uint) error {
	result := s.db.Delete(&domain.Art{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) AddLike(profileID string, artID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var art domain.Art
		if err := tx.Select("id").First(&art, artID).Error; err != nil {
			return nil
		}

		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&domain.ArtLike{
			ProfileID: profileID,
			ArtID:     artID,
		})
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected > 0 {
			return tx.Model(&domain.Art{ID: artID}).UpdateColumn("likes_count", gorm.Expr("likes_count + 1")).Error
		}
		return nil
	})
}

func (s *Store) RemoveLike(profileID string, artID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Delete(&domain.ArtLike{}, "profile_id = ? AND art_id = ?", profileID, artID)
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected > 0 {
			return tx.Model(&domain.Art{ID: artID}).UpdateColumn("likes_count", gorm.Expr("likes_count - 1")).Error
		}
		return nil
	})
}
