---
name: aws-lambda
description: "Manage AWS Lambda functions -- deploy, invoke, view logs, and configure."
metadata: {"thinkfleetbot":{"emoji":"⚡","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS Lambda

Manage serverless functions on AWS Lambda.

## Environment Variables

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_DEFAULT_REGION` - Region (e.g. `us-east-1`)

## List functions

```bash
aws lambda list-functions --query 'Functions[].{Name:FunctionName,Runtime:Runtime,Memory:MemorySize,Timeout:Timeout,Last:LastModified}' --output table
```

## Get function details

```bash
aws lambda get-function --function-name my-function | jq '{Runtime: .Configuration.Runtime, Handler: .Configuration.Handler, Memory: .Configuration.MemorySize, Timeout: .Configuration.Timeout, CodeSize: .Configuration.CodeSize, Env: .Configuration.Environment.Variables}'
```

## Invoke function

```bash
aws lambda invoke --function-name my-function \
  --payload '{"key":"value"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-out.json && cat /tmp/lambda-out.json | jq .
```

## Invoke async

```bash
aws lambda invoke --function-name my-function \
  --invocation-type Event \
  --payload '{"key":"value"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-out.json
echo "Invoked async"
```

## View recent logs

```bash
aws logs tail /aws/lambda/my-function --since 30m --format short
```

## Update function code (zip)

```bash
cd /tmp/lambda-code && zip -r /tmp/function.zip . && \
aws lambda update-function-code --function-name my-function \
  --zip-file fileb:///tmp/function.zip | jq '{FunctionName, LastModified, CodeSha256}'
```

## Update environment variables

```bash
aws lambda update-function-configuration --function-name my-function \
  --environment 'Variables={KEY1=value1,KEY2=value2}' | jq '{FunctionName, Environment}'
```

## Update memory / timeout

```bash
aws lambda update-function-configuration --function-name my-function \
  --memory-size 512 --timeout 30 | jq '{FunctionName, MemorySize, Timeout}'
```

## List versions / aliases

```bash
aws lambda list-versions-by-function --function-name my-function --query 'Versions[].{Version,Description,LastModified}' --output table
```

```bash
aws lambda list-aliases --function-name my-function --output table
```

## Get concurrency

```bash
aws lambda get-function-concurrency --function-name my-function
```

## Notes

- Use `--cli-binary-format raw-in-base64-out` for JSON payloads.
- Confirm before updating function code or configuration.
- For large deployments, use S3 bucket upload instead of zip.
