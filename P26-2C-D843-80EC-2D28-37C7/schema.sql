
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    poster_url TEXT,
    release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS reviews (
    user_id TEXT NOT NULL,
    filme_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
 
    PRIMARY KEY (user_id, filme_id),
    FOREIGN KEY (filme_id) REFERENCES movies(id) ON DELETE CASCADE
);


INSERT INTO movies (title, description) VALUES 
('O Senhor dos Anéis: A Sociedade do Anel', 'Um hobbit pacato recebe a missão de destruir um anel poderoso.'),
('Matrix', 'Um hacker descobre que a realidade é uma simulação.'),
('Jujutsu Kaisen 0', 'Yuta Okkotsu ganha o controle de um espírito amaldiçoado extremamente poderoso.');