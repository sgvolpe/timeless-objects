# Timeless Objects — data schema

`site/timeless-objects.json` (built from `parts/` by `merge.mjs`) is an array of objects in everyday use whose basic form has stayed
essentially the same since they were invented (materials may have changed; the design has not).

```json
{
  "id": 1,
  "slug": "toothpick",
  "name": "Toothpick",
  "category": "Personal care & hygiene",
  "invention": {
    "display": "c. 3500 BCE",
    "year": -3500,
    "approximate": true,
    "era": "Ancient"
  },
  "place_of_invention": {
    "region": "Mesopotamia",
    "modern_country": "Iraq",
    "notes": "Earliest known examples; likely used independently by many cultures."
  },
  "inventor": null,
  "short_description": "A small stick used to remove food from between the teeth.",
  "description": "2-4 sentences of history and use.",
  "why_unchanged": "One sentence on why the design never needed to change.",
  "materials": ["wood", "bamboo"],
  "faqs": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ],
  "image": {
    "search_query": "wooden toothpicks close up",
    "wikimedia_commons_category": "Toothpicks",
    "alt": "A pile of wooden toothpicks"
  },
  "tags": ["hygiene", "wood", "ancient"],
  "confidence": "medium"
}
```

## Field rules

- `invention.year`: integer, negative = BCE. Use the best single estimate (midpoint of a range).
- `invention.era`: one of `Prehistoric` (< 3000 BCE), `Ancient` (3000 BCE–500 CE),
  `Medieval` (500–1500), `Early Modern` (1500–1800), `Industrial` (1800–1900), `Modern` (1900+).
- `inventor`: a name only when history credits a specific person (e.g. "Walter Hunt" for the
  safety pin), otherwise `null`. Never guess.
- `confidence`: how solid the dating/place is — `high` (documented patent/record),
  `medium` (archaeological consensus), `low` (folklore or disputed).
- `image`: no image URLs are stored. `search_query` and `wikimedia_commons_category` are hints
  for sourcing freely licensed images later; verify licensing before publishing.
