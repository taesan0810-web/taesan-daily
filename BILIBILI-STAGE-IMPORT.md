# Bilibili Personal Fancams

- Account: 韩东旼_TaesanSilva, UID `383798385`.
- Collection: `直拍`, season `9582384`, 190 unique public videos at capture.
- Destination: WORK > STAGE > 个人直拍.
- Dates use Bilibili's `pubdate`, converted to Asia/Shanghai, not the performance
  date that may appear in a title. Source titles are retained without rewriting.
- Each cover is the same image served by Bilibili's image CDN at 960px width,
  without cropping. Copies are hosted in `assets/stage/bilibili` so rendering does
  not depend on third-party hotlink/referrer behavior. Original image URLs and
  SHA-256 hashes of hosted copies are recorded in the manifest.
- Videos are not copied, downloaded, or embedded. Both the cover and source link
  open the original Bilibili video in a new tab.
- STAGE has visible category filters; direct links accept `?category=个人直拍`.
  The existing date sort, search, pagination, editor and other categories remain.

## Import Safety

`scripts/import-bilibili-stage.cjs` validates the uploader/collection, unique BV
IDs, public availability, image hosts and bitmap data. It prepares a manifest and
SQL; it does not hold credentials or connect to Supabase. IDs are deterministic
UUIDv5 values derived from BV IDs. The prepared SQL only inserts missing records,
checking existing IDs, canonical URLs and BV IDs. It does not update or delete
existing records and does not change schema or policies.

The prepared transaction was tested with ROLLBACK before publishing. After asset
deployment, the same transaction can be committed using the existing administrator
role and RLS. Repeating it skips existing videos rather than creating duplicates.

## Reproduction

Save the public metadata response for a video in this collection, then run:

```sh
NODE_USE_ENV_PROXY=1 node scripts/import-bilibili-stage.cjs \
  --input /path/to/public-video-metadata.json \
  --download-covers --sql work/bilibili-stage-import.sql
node tests/bilibili-stage.test.cjs
node tests/stage-category.test.cjs
```

The metadata endpoint used for this snapshot was
`https://api.bilibili.com/x/web-interface/view?bvid=BV1Tvnq6qEHF`; its `ugc_season`
provided the complete collection. No login cookies or private endpoints were used.
The browser category test uses a static server on localhost:8010 and intercepted
API fixtures; it never writes to production.
