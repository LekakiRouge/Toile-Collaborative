-- Schéma de la base de données pour la Toile Collaborative
-- Encodage utf8mb4 pour supporter les accents et emojis.

CREATE DATABASE IF NOT EXISTS toile
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE toile;

-- Une "toile" = un dessin partagé, accessible via un lien (slug unique).
CREATE TABLE IF NOT EXISTS canvases (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  slug       VARCHAR(32)  NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL DEFAULT 'Toile collaborative',
  width      INT          NOT NULL DEFAULT 1600,
  height     INT          NOT NULL DEFAULT 900,
  bg_color   VARCHAR(16)  NOT NULL DEFAULT '#ffffff',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Chaque "stroke" est un élément dessiné (trait, forme, remplissage...).
-- On garde le prénom et le pseudo de l'auteur ainsi que l'horodatage,
-- ce qui permet la vue admin et la gestion des permissions par élément.
CREATE TABLE IF NOT EXISTS strokes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  canvas_id  INT          NOT NULL,
  prenom     VARCHAR(100) NOT NULL,
  pseudo     VARCHAR(100) NOT NULL,
  tool       VARCHAR(20)  NOT NULL,
  data       MEDIUMTEXT   NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  INDEX idx_canvas (canvas_id, id),
  CONSTRAINT fk_strokes_canvas FOREIGN KEY (canvas_id)
    REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB;
