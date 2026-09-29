package auth

import (
	"context"
	"geekverse/internal/domain"
	"net/http"
	"strings"

	"github.com/go-chi/render"
	"gorm.io/gorm"
)

type contextKey string

const (
	profileIDKey contextKey = "profileID"
	roleKey      contextKey = "role"
)

func GetProfileID(ctx context.Context) string {
	id, _ := ctx.Value(profileIDKey).(string)
	return id
}

func GetRole(ctx context.Context) string {
	role, _ := ctx.Value(roleKey).(string)
	return role
}

func RequireAuth(db *gorm.DB, validator *Validator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "cabeçalho Authorization é obrigatório"})
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "formato inválido"})
				return
			}

			profileID, err := validator.ValidateToken(parts[1])
			if err != nil {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "token inválido"})
				return
			}

			var profile domain.Profile
			if err := db.Select("role").First(&profile, "id = ?", profileID).Error; err != nil {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "perfil não encontrado"})
				return
			}

			ctx := context.WithValue(r.Context(), profileIDKey, profileID)
			ctx = context.WithValue(ctx, roleKey, profile.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := GetRole(r.Context())
			if userRole == "" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "usuário não autenticado"})
				return
			}

			hasRole := false
			for _, role := range allowedRoles {
				if userRole == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				render.Status(r, http.StatusForbidden)
				render.JSON(w, r, map[string]string{"error": "acesso negado"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
