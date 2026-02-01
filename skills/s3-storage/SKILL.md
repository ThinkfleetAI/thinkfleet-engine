---
name: s3-storage
description: "Upload, download, and list files in S3-compatible storage (AWS S3, Cloudflare R2) using Python boto3."
metadata: {"thinkfleetbot":{"emoji":"☁️","requires":{"bins":["python3"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# S3 Storage

File operations on S3-compatible storage (AWS S3, Cloudflare R2, MinIO).

## Environment Variables

- `AWS_ACCESS_KEY_ID` - Access key
- `AWS_SECRET_ACCESS_KEY` - Secret key
- `AWS_DEFAULT_REGION` - Region (default: `us-east-1`)
- `S3_ENDPOINT` - Custom endpoint for R2/MinIO (optional)
- `S3_BUCKET` - Default bucket name

## Setup

```bash
pip3 install boto3 2>/dev/null
```

## List objects

```bash
python3 -c "
import boto3, os
s3 = boto3.client('s3',
    endpoint_url=os.environ.get('S3_ENDPOINT'),
    region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))
resp = s3.list_objects_v2(Bucket=os.environ['S3_BUCKET'], MaxKeys=20)
for obj in resp.get('Contents', []):
    print(f\"{obj['Key']}  {obj['Size']}  {obj['LastModified']}\")
"
```

## Upload a file

```bash
python3 -c "
import boto3, os, sys
s3 = boto3.client('s3', endpoint_url=os.environ.get('S3_ENDPOINT'))
s3.upload_file(sys.argv[1], os.environ['S3_BUCKET'], sys.argv[2])
print(f'Uploaded {sys.argv[2]}')
" /tmp/local-file.txt remote/path/file.txt
```

## Download a file

```bash
python3 -c "
import boto3, os, sys
s3 = boto3.client('s3', endpoint_url=os.environ.get('S3_ENDPOINT'))
s3.download_file(os.environ['S3_BUCKET'], sys.argv[1], sys.argv[2])
print(f'Downloaded to {sys.argv[2]}')
" remote/path/file.txt /tmp/downloaded.txt
```

## Notes

- For R2, set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`.
- boto3 auto-reads `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from env.
