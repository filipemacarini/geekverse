package auth

import (
	"errors"
	"fmt"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type Validator struct {
	jwks keyfunc.Keyfunc
}

func NewValidator(supabaseURL string, apiKey string) (*Validator, error) {
	if supabaseURL == "" {
		return nil, errors.New("SUPABASE_URL ou SUPABASE_KEY não configuradas")
	}

	jwksURL := fmt.Sprintf("%s/auth/v1/.well-known/jwks.json?apikey=%s", strings.TrimRight(supabaseURL, "/"), apiKey)

	jwks, err := keyfunc.NewDefault([]string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("falha ao obter JWKS do Supabase: %w", err)
	}

	return &Validator{jwks: jwks}, nil
}

func (v *Validator) ValidateToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, v.jwks.Keyfunc)
	if err != nil {
		return "", err
	}

	if !token.Valid {
		return "", errors.New("token inválido")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("falha ao ler claims do token")
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", errors.New("token não contém sub")
	}

	return sub, nil
}
