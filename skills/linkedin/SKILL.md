---
name: linkedin
description: "Query LinkedIn — profile, connections, posts, and organization pages via the REST API."
metadata: {"thinkfleetbot":{"emoji":"💼","requires":{"bins":["curl","jq"],"env":["LINKEDIN_ACCESS_TOKEN"]}}}
---

# LinkedIn

Query profile, posts, and organization data via the LinkedIn API.

## Environment Variables

- `LINKEDIN_ACCESS_TOKEN` - OAuth 2.0 access token

## Get profile

```bash
curl -s -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  "https://api.linkedin.com/v2/userinfo" | jq '{sub, name, email, picture}'
```

## Get organization

```bash
curl -s -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  "https://api.linkedin.com/v2/organizations/ORG_ID" | jq '{id, localizedName, vanityName}'
```

## Create post

```bash
curl -s -X POST -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.linkedin.com/v2/ugcPosts" \
  -d '{"author":"urn:li:person:PERSON_ID","lifecycleState":"PUBLISHED","specificContent":{"com.linkedin.ugc.ShareContent":{"shareCommentary":{"text":"Post content here"},"shareMediaCategory":"NONE"}},"visibility":{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}}' | jq '{id}'
```

## Notes

- Always confirm before creating posts.
- Scopes needed vary by endpoint (r_liteprofile, w_member_social, etc.).
