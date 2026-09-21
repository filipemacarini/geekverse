package title

import (
	"errors"
	"geekverse/internal/domain"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/validator"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"gorm.io/gorm"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

type createRequest struct {
	Name            string `json:"name" validate:"required,min=2,max=150" example:"Solo Leveling"`
	Synopsis        string `json:"synopsis" example:"O caçador mais fraco do mundo..."`
	CoverURL        string `json:"cover_url" validate:"required,url" example:"https://exemplo.com/capa.jpg"`
	BannerURL       string `json:"banner_url" validate:"omitempty,url" example:"https://exemplo.com/banner.jpg"`
	Type            string `json:"type" validate:"required,oneof=anime manga novel" example:"anime"`
	AgeRating       string `json:"age_rating" validate:"required,oneof=L 12 14 16 18" example:"16"`
	Status          string `json:"status" validate:"required,oneof=releasing completed" example:"releasing"`
	Source          string `json:"source" example:"ID000001"`
	PublicationYear int    `json:"publication_year" validate:"required" example:"2024"`
}

type updateRequest struct {
	Name            *string `json:"name" validate:"omitempty,min=2,max=150"`
	Synopsis        *string `json:"synopsis"`
	CoverURL        *string `json:"cover_url" validate:"omitempty,url"`
	BannerURL       *string `json:"banner_url" validate:"omitempty,url"`
	Type            *string `json:"type" validate:"omitempty,oneof=anime manga novel"`
	AgeRating       *string `json:"age_rating" validate:"omitempty,oneof=L 12 14 16 18"`
	Status          *string `json:"status" validate:"omitempty,oneof=releasing completed"`
	Source          *string `json:"source"`
	PublicationYear *int    `json:"publication_year"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", httperr.Wrap(h.List))
	r.Get("/{id}", httperr.Wrap(h.GetByID))
	r.Post("/", httperr.Wrap(h.Create))
	r.Patch("/{id}", httperr.Wrap(h.Update))
	r.Delete("/{id}", httperr.Wrap(h.Delete))
	return r
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	mediaType := r.URL.Query().Get("type")
	titles, err := h.store.FindAll(mediaType)
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return titles, http.StatusOK, nil
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	title, err := h.store.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return title, http.StatusOK, nil
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	var req createRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}

	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	newTitle := domain.Title{
		Name:            req.Name,
		Synopsis:        req.Synopsis,
		CoverURL:        req.CoverURL,
		BannerURL:       req.BannerURL,
		Type:            req.Type,
		AgeRating:       req.AgeRating,
		Status:          req.Status,
		Source:          req.Source,
		PublicationYear: req.PublicationYear,
	}

	if err := h.store.Create(&newTitle); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return &newTitle, http.StatusCreated, nil
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	var req updateRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}

	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	title, err := h.store.Update(uint(id), req)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return title, http.StatusOK, nil
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	_, err = h.store.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("obra não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	if err := h.store.Delete(uint(id)); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "obra removida com sucesso"}, http.StatusOK, nil
}
