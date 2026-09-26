// The Explore feed. It will come from the server; until then the screen shows PLACEHOLDER_FEED.

export type ExploreBook = { id: string; title: string; author: string; cover?: string };

// One card in a lower section: a Wikipedia article, an essay, ...
export type ExploreItem = { id: string; title: string; subtitle?: string; image?: string };

// The link next to a section title, e.g. "See All" or "Browse".
export type SectionAction = { label: string };

export type BookSection = { title: string; action?: SectionAction; items: ExploreBook[] };

export type ItemSection = { id: string; title: string; icon?: string; action?: SectionAction; items: ExploreItem[] };

// Books are their own field so they always come first, with their own layout.
export type ExploreFeed = { books: BookSection; sections: ItemSection[] };

export const PLACEHOLDER_FEED: ExploreFeed = {
  books: {
    title: 'Books',
    action: { label: 'See All' },
    items: [
      { id: 'alice', title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll' },
      { id: 'last-bow', title: 'His Last Bow', author: 'Arthur Conan Doyle' },
      { id: 'tempest', title: 'The Tempest', author: 'William Shakespeare' },
      { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley' },
    ],
  },
  sections: [
    {
      id: 'wikipedia',
      title: 'Wikipedia',
      action: { label: 'Browse' },
      items: [
        { id: 'founding', title: 'The Founding of a Republic', subtitle: '2009 Chinese film' },
        { id: 'triphenylphosphine', title: 'Triphenylphosphine', subtitle: 'Chemical compound' },
        { id: 'apollo-11', title: 'Apollo 11', subtitle: 'First crewed Moon landing' },
      ],
    },
    {
      id: 'essays',
      title: 'Essays',
      action: { label: 'See All' },
      items: [
        { id: 'memory', title: 'The Ethics of Memory Editing', subtitle: 'Neuroscience' },
        { id: 'family', title: 'Challenging Family Traditions', subtitle: 'Psychology' },
      ],
    },
  ],
};
