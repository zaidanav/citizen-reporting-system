# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o report-service ./services/report-service

# Run Stage
FROM alpine:latest

WORKDIR /root/

COPY --from=builder /app/report-service .

EXPOSE 8082

CMD ["./report-service"]
