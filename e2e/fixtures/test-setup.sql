-- Test data setup for E2E tests
-- This should be run against a test Directus instance

-- Create test collections if not exists
CREATE TABLE IF NOT EXISTS content_text (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    status VARCHAR(20) DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS content_image (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    image UUID,
    alt_text VARCHAR(255),
    status VARCHAR(20) DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS content_hero (
    id SERIAL PRIMARY KEY,
    headline VARCHAR(255),
    subheadline TEXT,
    background_image UUID,
    cta_text VARCHAR(100),
    cta_link VARCHAR(255),
    status VARCHAR(20) DEFAULT 'draft'
);

-- Create test page
INSERT INTO pages (id, title, slug, status) 
VALUES (9999, 'E2E Test Page', 'e2e-test-page', 'draft')
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title;

-- Create junction table
CREATE TABLE IF NOT EXISTS pages_content_blocks (
    id SERIAL PRIMARY KEY,
    pages_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    collection VARCHAR(64),
    item INTEGER,
    sort INTEGER DEFAULT 0
);

-- Clean up existing test data
DELETE FROM pages_content_blocks WHERE pages_id = 9999;

-- Insert test blocks
INSERT INTO content_text (id, title, content, status) VALUES 
(9001, 'Test Text Block 1', 'This is test content for E2E testing.', 'published'),
(9002, 'Test Text Block 2', 'Another test block with different content.', 'draft');

INSERT INTO content_image (id, title, alt_text, status) VALUES 
(9003, 'Test Image Block', 'Test image description', 'published');

-- Link blocks to test page
INSERT INTO pages_content_blocks (pages_id, collection, item, sort) VALUES
(9999, 'content_text', 9001, 0),
(9999, 'content_text', 9002, 1),
(9999, 'content_image', 9003, 2);