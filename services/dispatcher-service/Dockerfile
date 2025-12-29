# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o dispatcher-service ./services/dispatcher-service

# Run Stage
FROM alpine:latest

WORKDIR /root/

COPY --from=builder /app/dispatcher-service .

# Dispatcher is a background worker, so strictly speaking it doesn't need to expose a port 
# unless we add health checks or metrics later.
# EXPOSE 8083 

CMD ["./dispatcher-service"]
