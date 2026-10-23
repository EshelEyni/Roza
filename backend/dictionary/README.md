# Local Reader dictionaries

The backend performs local English-to-Hebrew lookups. No translation API, AI service or new environment variable is required.

## Bundled data

| File | Purpose |
| --- | --- |
| `wiktionary-en-he.json` | Primary dictionary: 12,599 supported English headwords, 17,246 translated senses, 49,403 attested form mappings. |
| `wiktionary-manifest.json` | Source URL, dump date, SHA-256, counts and recorded modifications. |
| `english-hebrew.json` | Princeton WordNet 3.0 / Hebrew WordNet fallback. |
| `hebrew.tab` | Hebrew WordNet source for rebuilding the fallback. |
| `WIKTIONARY-LICENSE`, `WORDNET-LICENSE`, `HEBREW-LICENSE` | Required data licenses and notices. |

Together the sources provide **17,558 distinct supported headwords**. Wiktionary adds 9,139 headwords absent from WordNet. Form mappings are not additional translations. The original WordNet file includes phrases, excluded from the supported single-word count.

Wiktionary is preferred for a translated headword; WordNet supplies words absent from the Wiktionary subset. The JSON indexes are keyed by normalized headword and loaded once per backend process. Only one matching entry is sent to the browser. Keep this directory alongside `backend/build/`; the Docker production stage copies it automatically. Restart the backend after replacing data.

## Wiktionary source and attribution

- [English Wiktionary](https://en.wiktionary.org/), by Wiktionary contributors.
- Extracted by [Wiktextract](https://github.com/tatuylonen/wiktextract), distributed by [Kaikki](https://kaikki.org/dictionary/English/).
- This snapshot uses the English-language extract from the **2026-10-01** enwiktionary dump. The manifest records the exact source URL, file checksum and byte count.
- Derived dictionary data is distributed under **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. Preserve attribution, source links, the notice and the license when distributing adapted data. This data license is separate from application code licensing.
- The reader displays source-entry links and the license. Every imported sense retains its original Wiktionary page URL, including capitalization.

The importer retains actual Hebrew translations of English entries. It does not reverse Hebrew glosses or invent translations. Translation labels remain separate meaning groups. Examples are attached only to explicitly associated senses; attributed quotations are omitted. Ambiguous free-text translation labels are displayed as supplied rather than attached to an unrelated definition. Usage labels are retained when their association is explicit.

Inflections and alternative spellings use attested forms/form-of links. Links resolve only to translated headwords with a matching part of speech, with cycle protection. The runtime also accepts WordNet irregular forms and English possessives. It no longer strips arbitrary suffixes, which could previously return misleading translations.

The upstream snapshot contains one record with literal newlines inside a JSON string. The importer escapes those newlines, records the repair count, and fails on unrecoverable or truncated records. It does not silently drop malformed entries.

### Download and rebuild

From the repository root in PowerShell:

```powershell
New-Item -ItemType Directory -Force .data/wiktionary
curl.exe --fail --location --retry 3 --output .data/wiktionary/english.jsonl https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
node scripts/build-wiktionary-dictionary.cjs .data/wiktionary/english.jsonl 2026-10-01
node --test scripts/dictionary/wiktionary.test.cjs
```

Use the dump date shown by Kaikki for the file you download; the current URL changes over time. The manifest records the actual bytes' checksum for auditing. The source download is about 3.4 GB; `.data/` is ignored by Git. Only the filtered dictionary (about 7.2 MB), manifest and licenses belong in Git.

The compiler reads JSONL line by line, accepts `.jsonl.gz`, and requires no additional npm packages. It writes output only after successful parsing and validation. Kaikki is deprecating its postprocessed downloads; the importer also accepts raw English Wiktextract records with translations at either entry or sense level. See [raw download options](https://kaikki.org/dictionary/rawdata.html) when refreshing the source.

## WordNet source and rebuild

- English definitions, examples and irregular forms: [Princeton WordNet 3.0](https://wordnet.princeton.edu/download/current-version), archive https://wordnetcode.princeton.edu/3.0/WordNet-3.0.tar.gz.
- Hebrew meanings and explanations: [Hebrew WordNet through OMW](https://github.com/omwn/omw-data/tree/main/wns/heb), file `wn-data-heb.tab`.
- Preserve [WORDNET-LICENSE](WORDNET-LICENSE) and [HEBREW-LICENSE](HEBREW-LICENSE).

Extract WordNet, then run from the root:

```powershell
node scripts/build-reader-dictionary.cjs C:\path\to\WordNet-3.0
```

Rebuild Wiktionary after changing the fallback so its form index includes any added WordNet headwords.

## Coverage and limitations

In the owner's EPUB sample, the previous lookup matched 5,836 of 16,430 distinct extracted words; the combined lookup matches 9,229. Matches by word occurrence rose from 86,835 / 241,545 (36.0%) to 220,604 / 241,545 (91.3%). These are lexical lookup hits, including function words, not a translation accuracy score. The sample, extracted word list and large source download are not committed.

Some uncommon words, names and senses still lack Hebrew translations; English-only entries are not counted as translated. Meanings are not ranked using sentence context. Pronunciation continues to use the browser's installed English speech voice.
