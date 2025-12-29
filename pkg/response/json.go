package response

import (
	"encoding/json"
	"net/http"
)

type APIResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func JSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func Success(w http.ResponseWriter, statusCode int, message string, data interface{}) {
	resp := APIResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	}
	JSON(w, statusCode, resp)
}

func Error(w http.ResponseWriter, statusCode int, message string, errDetail string) {
	resp := APIResponse{
		Status:  "error",
		Message: message,
		Error:   errDetail,
	}
	JSON(w, statusCode, resp)
}
