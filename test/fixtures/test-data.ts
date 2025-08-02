/**
 * Test Data Fixtures for E2E Tests
 * Provides sample data for testing the ExpandableBlocks extension
 */

export const testCollections = {
  content_blocks: 'test_content_blocks',
  pages: 'test_pages',
  categories: 'test_categories'
};

export const testContentBlocks = [
  {
    title: 'Hero Block',
    content: 'This is a hero content block for testing',
    status: 'published'
  },
  {
    title: 'Text Block',
    content: 'This is a text content block with some sample content',
    status: 'published'
  },
  {
    title: 'Image Block',
    content: 'This is an image block for testing purposes',
    status: 'draft'
  }
];

export const testPages = [
  {
    title: 'Homepage',
    content: 'This is the homepage content',
    status: 'published'
  },
  {
    title: 'About Page',
    content: 'This is the about page content',
    status: 'published'
  },
  {
    title: 'Contact Page',
    content: 'This is the contact page content',
    status: 'draft'
  }
];

export const testCategories = [
  {
    title: 'Technology',
    content: 'Technology related content',
    status: 'published'
  },
  {
    title: 'Design',
    content: 'Design related content',
    status: 'published'
  }
];

/**
 * Get test data for a specific collection
 */
export function getTestDataForCollection(collectionName: string): any[] {
  switch (collectionName) {
    case testCollections.content_blocks:
      return testContentBlocks;
    case testCollections.pages:
      return testPages;
    case testCollections.categories:
      return testCategories;
    default:
      return [];
  }
}