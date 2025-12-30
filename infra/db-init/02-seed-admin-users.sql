-- Seed Admin Users for Testing
-- Password for all: admin123 (hashed with bcrypt)

INSERT INTO users (email, password, name, role, access_role, department, created_at) VALUES
-- Admin Umum (can see all categories) - Operational
('admin@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Umum', 'admin', 'operational', 'general', NOW()),

-- Pimpinan Strategis (can see all + analytics)
('pimpinan@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Pimpinan Dinas', 'admin', 'strategic', 'general', NOW()),

-- Dinas Kebersihan (only Sampah) - Operational
('kebersihan@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Kebersihan', 'admin', 'operational', 'kebersihan', NOW()),

-- Dinas Pekerjaan Umum (Jalan Rusak, Drainase, Fasilitas Umum) - Operational
('pekerjaanumum@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Pekerjaan Umum', 'admin', 'operational', 'pekerjaan-umum', NOW()),

-- Dinas Penerangan Jalan - Operational
('penerangan@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Penerangan', 'admin', 'operational', 'penerangan', NOW()),

-- Dinas Lingkungan Hidup - Operational
('lingkungan@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Lingkungan Hidup', 'admin', 'operational', 'lingkungan-hidup', NOW()),

-- Dinas Perhubungan - Operational
('perhubungan@dinas.com', '$2a$10$X8qJ9YH5fN6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5YeH5N6qX5Y5Y5Y5Ye', 'Admin Perhubungan', 'admin', 'operational', 'perhubungan', NOW())
ON CONFLICT (email) DO NOTHING;
