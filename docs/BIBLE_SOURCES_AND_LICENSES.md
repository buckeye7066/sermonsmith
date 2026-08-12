# Bible Sources And Licenses

The API source of truth is `services/api/src/services/bibleSources.js`. Route handlers must use that registry rather than hardcoded translation arrays.

## Current Registry

| ID | Translation | Language | Display | Export | Notes |
| --- | --- | --- | --- | --- | --- |
| `kjv` | King James Version | English | Yes | Yes | Public domain in the United States. |
| `web` | World English Bible | English | Yes | Yes | Public domain; "World English Bible" is a trademark of eBible.org. |
| `bbe` | Bible in Basic English | English | Yes | Yes | Public domain in the United States. |
| `asv` | American Standard Version (1901) | English | Yes | Yes | Public domain in the United States. |
| `ylt` | Young's Literal Translation | English | Yes | Yes | Public domain. |
| `darby` | Darby Bible | English | Yes | Yes | Public domain. |
| `clementine` | Clementine Vulgate | Latin | Yes | Yes | Public domain. |
| `almeida` | Joao Ferreira de Almeida | Portuguese | Yes | Yes | Public domain. |

## Route Contract

`POST /api/functions/listAvailableTranslations` returns the registry metadata.

`POST /api/functions/biblePassage` and `POST /api/functions/getPassageMultiSource` include a `translation` object on each result with:

- `id`
- `name`
- `language`
- `sourceUrl`
- `license`
- `attribution`
- `copyrightNotice`
- `publicDomain`
- `displayAllowed`
- `exportAllowed`

`POST /api/functions/verifyVerseWording` fetches exact provider text for a registered public-domain translation and compares it to a supplied quotation. A canon-valid reference with wrong wording returns `status: "mismatch"`. Canon/reference shape checking remains a separate gate in `@sermonsmith/shared/scripture`.

Unsupported translations fail with HTTP 400 before any upstream request is made.

## Caching

Successful Bible API responses are cached in Postgres:

- whole chapters use `BibleChapterCache` keyed by translation, book, and chapter
- verse/range lookups use `BiblePassageCache` keyed by translation and normalized reference
- cache freshness is controlled by `BIBLE_CACHE_TTL_MS`, defaulting to 30 days
- upstream failures and timeouts are not cached

`getPassageMultiSource` normalizes and deduplicates translation ids before lookup, so aliases like `en-kjv` and duplicate `kjv` entries produce one cached/upstream request.

## Adding A Translation

1. Confirm display and export rights for the deployment territory.
2. Add the translation metadata to `bibleSources.js`.
3. Add or update tests in `services/api/src/__tests__/functions.test.js`.
4. If the text is not exportable, set `exportAllowed: false` and make client export flows omit it.

## Source References

- https://bible-api.com/
- https://worldenglish.bible/
- https://ebible.org/engBBE/copyright.htm
- https://ebible.org/eng-asv/oldindex.htm
