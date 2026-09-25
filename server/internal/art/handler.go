package art

import (
	"encoding/json"
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
	ProfileID   string `json:"profile_id" validate:"required" example:"11111111-1111-1111-1111-111111111111"`
	Title       string `json:"title" validate:"required,min=2,max=100" example:"Fanart do Goku"`
	Description string `json:"description" example:"Deu muito trabalho!"`
	ImageURL    string `json:"image_url" validate:"required,url" example:"https://exemplo.com/arte.jpg"`
}

type updateRequest struct {
	Title       *string `json:"title,omitempty" validate:"omitempty,min=2,max=100"`
	Description *string `json:"description,omitempty"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", httperr.Wrap(h.List))
	r.Get("/{id}", httperr.Wrap(h.GetByID))
	r.Post("/", httperr.Wrap(h.Create))
	r.Patch("/{id}", httperr.Wrap(h.Update))
	r.Delete("/{id}", httperr.Wrap(h.Delete))

	r.Post("/{id}/likes/{profile_id}", httperr.Wrap(h.AddLike))
	r.Delete("/{id}/likes/{profile_id}", httperr.Wrap(h.RemoveLike))

	return r
}

// @Tags Arts
// @Success 200 {array} domain.Art
// @Router /arts [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	arts, err := h.store.FindAll()
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return arts, http.StatusOK, nil
}

// @Tags Arts
// @Param id path int true "ID da Arte"
// @Success 200 {object} domain.Art
// @Router /arts/{id} [get]
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	art, err := h.store.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return art, http.StatusOK, nil
}

// @Tags Arts
// @Param request body createRequest true "Dados da Arte"
// @Success 201 {object} domain.Art
// @Router /arts [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	var req createRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}
	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	newArt := domain.Art{
		ProfileID:   req.ProfileID,
		Title:       req.Title,
		Description: req.Description,
		ImageURL:    req.ImageURL,
	}

	if err := h.store.Create(&newArt); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("perfil do autor não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return &newArt, http.StatusCreated, nil
}

// @Tags Arts
// @Param id path int true "ID da Arte"
// @Param request body updateRequest true "Campos para atualizar"
// @Success 200 {object} map[string]string
// @Router /arts/{id} [patch]
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

	var updates map[string]interface{}
	data, _ := json.Marshal(req)
	_ = json.Unmarshal(data, &updates)

	if err := h.store.Update(uint(id), updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "arte atualizada com sucesso"}, http.StatusOK, nil
}

// @Tags Arts
// @Param id path int true "ID da Arte"
// @Success 200 {object} map[string]string
// @Router /arts/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	if err := h.store.Delete(uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "arte removida com sucesso"}, http.StatusOK, nil
}

// @Tags Arts
// @Param id path int true "ID da Arte"
// @Param profile_id path string true "UUID do Perfil"
// @Success 201 {object} map[string]string
// @Router /arts/{id}/likes/{profile_id} [post]
func (h *Handler) AddLike(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}
	profileID := chi.URLParam(r, "profile_id")

	if err := h.store.AddLike(profileID, uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "curtida adicionada"}, http.StatusCreated, nil
}

// @Tags Arts
// @Param id path int true "ID da Arte"
// @Param profile_id path string true "UUID do Perfil"
// @Success 200 {object} map[string]string
// @Router /arts/{id}/likes/{profile_id} [delete]
func (h *Handler) RemoveLike(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}
	profileID := chi.URLParam(r, "profile_id")

	if err := h.store.RemoveLike(profileID, uint(id)); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "curtida removida"}, http.StatusOK, nil
}
