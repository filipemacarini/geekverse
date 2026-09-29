package art

import (
	"encoding/json"
	"errors"
	"geekverse/internal/domain"
	"geekverse/internal/platform/auth"
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
	Title       string `json:"title" validate:"required,min=2,max=100" example:"Fanart do Goku"`
	Description string `json:"description" example:"Deu muito trabalho!"`
	ImageURL    string `json:"image_url" validate:"required,url" example:"https://exemplo.com/arte.jpg"`
}

type updateRequest struct {
	Title       *string `json:"title,omitempty" validate:"omitempty,min=2,max=100"`
	Description *string `json:"description,omitempty"`
}

func (h *Handler) Routes(requireAuth func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	r.Get("/", httperr.Wrap(h.List))
	r.Get("/{id}", httperr.Wrap(h.GetByID))

	r.Group(func(protected chi.Router) {
		protected.Use(requireAuth)

		protected.Post("/", httperr.Wrap(h.Create))
		protected.Patch("/{id}", httperr.Wrap(h.Update))
		protected.Delete("/{id}", httperr.Wrap(h.Delete))

		protected.Post("/{id}/likes/", httperr.Wrap(h.AddLike))
		protected.Delete("/{id}/likes/", httperr.Wrap(h.RemoveLike))
	})

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
// @Security BearerAuth
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
		ProfileID:   auth.GetProfileID(r.Context()),
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
// @Security BearerAuth
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

	if _, status, err := h.findOwnedArt(r, uint(id)); err != nil {
		return nil, status, err
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
// @Security BearerAuth
// @Param id path int true "ID da Arte"
// @Success 200 {object} map[string]string
// @Router /arts/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}

	if _, status, err := h.findOwnedArt(r, uint(id)); err != nil {
		return nil, status, err
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
// @Security BearerAuth
// @Param id path int true "ID da Arte"
// @Success 201 {object} map[string]string
// @Router /arts/{id}/likes [post]
func (h *Handler) AddLike(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}
	profileID := auth.GetProfileID(r.Context())

	if err := h.store.AddLike(profileID, uint(id)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "curtida adicionada"}, http.StatusCreated, nil
}

// @Tags Arts
// @Security BearerAuth
// @Param id path int true "ID da Arte"
// @Success 200 {object} map[string]string
// @Router /arts/{id}/likes [delete]
func (h *Handler) RemoveLike(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("id inválido")
	}
	profileID := auth.GetProfileID(r.Context())

	if err := h.store.RemoveLike(profileID, uint(id)); err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return map[string]string{"mensagem": "curtida removida"}, http.StatusOK, nil
}

func (h *Handler) findOwnedArt(r *http.Request, id uint) (*domain.Art, int, error) {
	art, err := h.store.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("arte não encontrada")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	callerID := auth.GetProfileID(r.Context())
	if art.ProfileID != callerID {
		return nil, http.StatusForbidden, errors.New("você não tem permissão para alterar esta arte")
	}

	return art, http.StatusOK, nil
}
