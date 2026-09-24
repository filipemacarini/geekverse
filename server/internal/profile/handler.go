package profile

import (
	"encoding/json"
	"errors"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/validator"
	"net/http"

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

type updateRequest struct {
	Username  *string `json:"username,omitempty" validate:"omitempty,min=4,max=50"`
	AvatarURL *string `json:"avatar_url,omitempty" validate:"omitempty,url"`
}

type updateRoleRequest struct {
	Role string `json:"role" validate:"required,oneof=user moderator content_manager admin" example:"moderator"`
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", httperr.Wrap(h.List))
	r.Get("/{id}", httperr.Wrap(h.GetByID))
	r.Patch("/{id}", httperr.Wrap(h.Update))
	r.Patch("/{id}/role", httperr.Wrap(h.UpdateRole))
	return r
}

// @Tags Profiles
// @Success 200 {array} domain.Profile
// @Router /profiles [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	profiles, err := h.store.FindAll()
	if err != nil {
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return profiles, http.StatusOK, nil
}

// @Tags Profiles
// @Param id path string true "UUID do Perfil"
// @Success 200 {object} domain.Profile
// @Router /profiles/{id} [get]
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id := chi.URLParam(r, "id")

	profile, err := h.store.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("perfil não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}
	return profile, http.StatusOK, nil
}

// @Tags Profiles
// @Param id path string true "UUID do Perfil"
// @Param request body updateRequest true "Campos para atualizar"
// @Success 200 {object} map[string]string
// @Router /profiles/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id := chi.URLParam(r, "id")

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

	if err := h.store.Update(id, updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("perfil não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "perfil atualizado com sucesso"}, http.StatusOK, nil
}

// @Tags Profiles
// @Param id path string true "UUID do Perfil"
// @Param request body updateRoleRequest true "Novo cargo"
// @Success 200 {object} map[string]string
// @Router /profiles/{id}/role [patch]
func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	id := chi.URLParam(r, "id")

	var req updateRoleRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		return nil, http.StatusBadRequest, errors.New("corpo da requisição inválido")
	}

	if err := validator.ValidateStruct(req); err != nil {
		return nil, http.StatusBadRequest, err
	}

	if err := h.store.UpdateRole(id, req.Role); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("perfil não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "cargo atualizado com sucesso"}, http.StatusOK, nil
}
