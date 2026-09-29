package profile

import (
	"encoding/json"
	"errors"
	"geekverse/internal/domain"
	"geekverse/internal/platform/auth"
	"geekverse/internal/platform/httperr"
	"geekverse/internal/platform/validator"
	"net/http"
	"time"

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

type publicProfileResponse struct {
	ID        string       `json:"id"`
	Username  string       `json:"username"`
	AvatarURL string       `json:"avatar_url"`
	CreatedAt time.Time    `json:"created_at"`
	Arts      []domain.Art `json:"arts,omitempty"`
}

func (h *Handler) Routes(requireAuth, requireAdmin func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	r.Get("/{id}", httperr.Wrap(h.GetByID))

	r.Group(func(users chi.Router) {
		users.Use(requireAuth)

		users.Get("/me", httperr.Wrap(h.GetMe))
		users.Patch("/me", httperr.Wrap(h.UpdateMe))
	})

	r.Group(func(admin chi.Router) {
		admin.Use(requireAuth)
		admin.Use(requireAdmin)

		admin.Get("/", httperr.Wrap(h.List))
		admin.Patch("/{id}/role", httperr.Wrap(h.UpdateRole))
	})

	return r
}

// @Tags Profiles
// @Security BearerAuth
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
// @Security BearerAuth
// @Success 200 {object} domain.Profile
// @Router /profiles/me [get]
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	callerID := auth.GetProfileID(r.Context())

	profile, err := h.store.FindByID(callerID)
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

	publicProfile := publicProfileResponse{
		ID:        profile.ID,
		Username:  profile.Username,
		AvatarURL: profile.AvatarURL,
		CreatedAt: profile.CreatedAt,
		Arts:      profile.Arts,
	}

	return publicProfile, http.StatusOK, nil
}

// @Tags Profiles
// @Security BearerAuth
// @Param request body updateRequest true "Campos para atualizar"
// @Success 200 {object} map[string]string
// @Router /profiles/me [patch]
func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) (interface{}, int, error) {
	callerID := auth.GetProfileID(r.Context())

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

	if err := h.store.Update(callerID, updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, http.StatusNotFound, errors.New("perfil não encontrado")
		}
		return nil, http.StatusInternalServerError, httperr.ErrInternal
	}

	return map[string]string{"mensagem": "perfil atualizado com sucesso"}, http.StatusOK, nil
}

// @Tags Profiles
// @Security BearerAuth
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
