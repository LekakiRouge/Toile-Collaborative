CREATE DATABASE IF NOT EXISTS toile_collaborative
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE toile_collaborative;

CREATE TABLE IF NOT EXISTS canvases (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  drawings_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
