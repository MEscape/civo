/** S3 and every compatible store cap an object key at 1024 bytes. Keys are ASCII-only (see `validateObjectKey`). */
export const MAX_OBJECT_KEY_LENGTH = 1024;

/** The longest a signed upload or read URL may live. Short on purpose: a signed URL is a bearer credential. */
export const MAX_SIGNED_URL_TTL_SECONDS = 3600;

/** S3's limit for one `PutObject`. Larger objects need multipart, which this contract does not offer. */
export const MAX_UPLOAD_BYTES = 5_368_709_120;

/** What `readStart` may return: enough for signature sniffing and image headers, never a whole file. */
export const MAX_READ_START_BYTES = 65_536;

/** RFC 6838's cap on a media type, and a ceiling on a cache-control value; both end up in a signed header. */
export const MAX_CONTENT_TYPE_LENGTH = 127;
export const MAX_CACHE_CONTROL_LENGTH = 128;
