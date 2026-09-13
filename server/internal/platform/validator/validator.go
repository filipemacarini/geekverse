package validator

import (
	"errors"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

func ValidateStruct(obj interface{}) error {
	err := validate.Struct(obj)
	if err == nil {
		return nil
	}

	validationErrors := err.(validator.ValidationErrors)

	firstErr := validationErrors[0]
	field := strings.ToLower(firstErr.StructField())

	switch firstErr.Tag() {
	case "required":
		return errors.New(field + " é obrigatório")
	case "min":
		return errors.New(field + " deve ter no mínimo " + firstErr.Param() + " caracteres")
	case "max":
		return errors.New(field + " deve ter no máximo " + firstErr.Param() + " caracteres")
	case "email":
		return errors.New(field + " deve ser um e-mail válido")
	case "url":
		return errors.New(field + " deve ser uma URL válida")
	case "oneof":
		return errors.New(field + " deve ser um dos seguintes valores: " + firstErr.Param())
	}

	return errors.New("campo " + field + " é inválido")
}
