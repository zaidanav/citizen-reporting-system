package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

// KeyFromEnv returns a 32-byte key for AES-GCM.
// Priority:
// 1) ANON_ENC_KEY (base64-encoded 32 bytes)
// 2) Derive from JWT_SECRET (sha256)
func KeyFromEnv() ([]byte, error) {
	if v := strings.TrimSpace(os.Getenv("ANON_ENC_KEY")); v != "" {
		b, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return nil, err
		}
		if len(b) != 32 {
			return nil, errors.New("ANON_ENC_KEY must decode to 32 bytes")
		}
		return b, nil
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" {
		jwtSecret = "SUPER_SECRET_KEY_CHANGE_ME"
	}
	sum := sha256.Sum256([]byte(jwtSecret))
	return sum[:], nil
}

func EncryptString(plaintext string) (string, error) {
	key, err := KeyFromEnv()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	payload := append(nonce, ciphertext...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

func DecryptString(ciphertextB64 string) (string, error) {
	key, err := KeyFromEnv()
	if err != nil {
		return "", err
	}
	payload, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	ns := gcm.NonceSize()
	if len(payload) < ns {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := payload[:ns], payload[ns:]

	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}
