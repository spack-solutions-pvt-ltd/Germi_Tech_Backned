# File uploads — S3 + CloudFront

All uploads go **browser → API → S3**. Public files are served by **CloudFront**;
employee ID documents stay **private** and are opened through short-lived signed links.

## Folders in the bucket

Folders are key prefixes — S3 creates them on the first upload, nothing to create by hand.

| Folder | What | Access | Stored in DB |
|---|---|---|---|
| `labour-requests/` | start / end photos | public (CloudFront) | `LabourRequests.startPhotoUrl`, `endPhotoUrl` |
| `expense-requests/` | bills | public (CloudFront) | `ExpenseRequests.billUrl` |
| `loading-requests/` | start / end / DK photos | public (CloudFront) | `LoadingRequests.startPhotoUrl`, `endPhotoUrl`, `LoadingRequestEntries.dkPhotoUrl` |
| `notifications/` | image + downloadable document | public (CloudFront) | `Notifications.imageUrl`, `documentUrl` |
| `employee-documents/` | Aadhaar, licence, RC, … | **private** (signed links) | `EmployeeDocuments.fileUrl` (the S3 key) |

Files are named `<folder>/<field>-<timestamp>-<random>.<ext>`, so they are never overwritten.

## 1. Create the bucket

S3 → Create bucket (e.g. `germitech-uploads`, region `ap-south-1`).
Keep **Block all public access = ON** — only CloudFront and the API read from it.

## 2. Create the CloudFront distribution

CloudFront → Create distribution:

- **Origin:** the bucket. **Origin access:** *Origin access control settings (recommended)* → create a new OAC.
- **Viewer protocol policy:** Redirect HTTP to HTTPS.
- **Cache policy:** CachingOptimized.
- Create it, then copy the policy CloudFront offers and paste it into
  **S3 → bucket → Permissions → Bucket policy**. It looks like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::germitech-uploads/labour-requests/*",
        "arn:aws:s3:::germitech-uploads/expense-requests/*",
        "arn:aws:s3:::germitech-uploads/loading-requests/*",
        "arn:aws:s3:::germitech-uploads/notifications/*"
      ],
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```

`employee-documents/*` is deliberately **not** listed, so ID proofs can't be read through CloudFront at all.

Note the distribution domain, e.g. `https://d1234abcd.cloudfront.net` (or attach your own domain such as `https://cdn.germitech.in`).

## 3. Give the API access

The API needs to write, read (for signed links) and delete objects.

- **On EC2 (recommended):** attach an IAM role with the policy below to the instance — no keys in `.env`.
- **Elsewhere / local dev:** create an IAM user with the policy and put its keys in `.env`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::germitech-uploads/*"
    }
  ]
}
```

## 4. `.env`

```env
AWS_REGION=ap-south-1
AWS_S3_BUCKET=germitech-uploads
CLOUDFRONT_URL=https://d1234abcd.cloudfront.net
# Only when not using an EC2 IAM role:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Restart the API after changing `.env`. If `AWS_REGION` / `AWS_S3_BUCKET` are missing, uploads fail with
"File storage is not configured".

## Showing files in the UI

**Public files** (request photos, bills, notification image/document) — the API returns a full CloudFront URL:

```jsx
<img src={request.startPhotoUrl} alt="Start photo" />
<a href={expense.billUrl} target="_blank" rel="noreferrer">View bill</a>
```

Rows uploaded **before** S3 still hold a relative path like `/uploads/labour-requests/x.jpg`
(served by the API as before). Use one helper everywhere:

```js
export const fileSrc = (url) =>
  !url ? null : /^https?:\/\//.test(url) ? url : `${import.meta.env.VITE_API_BASE_URL}${url}`;

<img src={fileSrc(request.startPhotoUrl)} />
```

**Notification document** — link to the download endpoint (keeps the original file name):
`GET /v1/admin/notifications/:id/document`

**Employee documents (private)** — every document in the API response has:

- `viewUrl` — signed link, valid `viewUrlExpiresIn` seconds (300). Open it right away; re-fetch the
  employee / document to get a fresh one, don't store it.
- Download: `GET /v1/admin/employee/:id/documents/:documentId/download` → redirects to a signed link
  that saves the file under its original name.

```jsx
<a href={doc.viewUrl} target="_blank" rel="noreferrer">View {doc.displayName}</a>
```

## Upload payloads (unchanged)

The multipart field names did not change: `start_photo`, `end_photo`, `bill`, `dk_photo`,
`image`, `document`. Images: JPEG/PNG/WEBP; bills & employee documents also PDF;
notification documents PDF/Word/Excel/CSV/PowerPoint/text. Limits: 10 MB per file (requests, employee documents, notifications); the server's nginx must allow at least 25 MB per request (client_max_body_size).
