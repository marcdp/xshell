# Authentication

Authentication is provided by the optional `x-identity` module. It is not a global XShell Core subsystem and does not add an
`xshell.identity` configuration section or an identity-provider resolver.

## Server-driven conversation

The browser Login Page is a generic presenter for `DProjects.Identity.Abstractions.ISignIn`. It starts with an empty request and renders each
`DataRequired` response without assuming login/password fields or a fixed number of steps:

```text
SignInRequest { headers }
    -> POST signinUrl
    <- SignInResponse { status, headers, fields, claimsPrincipal }
```

`status` is `DataRequired`, `Failure`, or `Success`. Fields use `Title`, `Paragraph`, `Text`, `Password`, or `Value` and contain `name`, `label`,
`description`, `placeHolder`, `required`, and `value`. All request and response header values are strings. Non-control response headers are opaque
continuation metadata and are carried into the next request. The client consumes `retry` as a control header instead of echoing it; when the user
accepts an allowed retry, the client increments the string `attempt` request header. No `step` or client-side wizard model is used.

Password fields are cleared after the request that uses them and are not automatically resent. Conversation data remains only in the live Page;
it is not placed in browser storage or URLs. Labels and descriptions are rendered as text.

## Configuration

The host configures the module reference with application or absolute HTTP(S) URLs:

```jsonc
"x-identity": {
    "configUrl": "url:../x-identity/manifest.jsonc",
    "params": {
        "signinUrl": "app:/api/identity/signin",
        "sessionUrl": "app:/api/identity/session",
        "signoutUrl": "app:/api/identity/signout"
    }
}
```

`app:` preserves deployments under a non-root application base. The module provides no default provider and reports a configuration error when a
required endpoint is absent.

## HTTP endpoint contract

All requests use `credentials: "same-origin"` and `cache: "no-store"`. The server owns validation, workflow state, expiry, attempt limiting,
replay protection, session issuance, cookie invalidation, and authorization.

### Sign in

`POST signinUrl` uses `Content-Type: application/json` and `Accept: application/json`:

```json
{ "headers": { "provider-defined-name": "string value" } }
```

A successful HTTP response contains the complete `SignInResponse` shape:

```json
{
  "status": "DataRequired",
  "headers": { "conversation": "opaque-server-value" },
  "fields": [
    {
      "name": "provider-defined-name",
      "label": "Prompt",
      "type": "Text",
      "description": "",
      "placeHolder": "",
      "required": true,
      "value": ""
    }
  ],
  "claimsPrincipal": null
}
```

Authentication `Failure` is still an HTTP-successful protocol response. Non-2xx status codes are transport failures; their response bodies are not
shown to the user. A `Success` response must include a well-formed ClaimsPrincipal representation, but the browser does not trust it alone: it
immediately restores the authoritative server session before updating Principal.

### Current session

`GET sessionUrl` uses `Accept: application/json`. HTTP 200 returns:

```json
{
  "claimsPrincipal": {
    "identities": [
      {
        "authenticationType": "password",
        "claims": [
          { "type": "name", "value": "example" }
        ]
      }
    ]
  }
}
```

Multiple identities and every claim are preserved. The explicit anonymous or expired-session response is HTTP 200 with
`{ "claimsPrincipal": null }`. Non-2xx responses mean retrieval failed and place Principal in `error`, rather than pretending the user is
anonymous.

### Sign out

`POST signoutUrl` invalidates the server session and expires its cookies. A 2xx response, including 204, confirms success; only then does the Session
service clear local Principal. A non-2xx response leaves Principal authenticated and reports that logout failed.

## CSRF and security boundary

Sign-in and sign-out are credentialed state-changing requests. The server must apply its CSRF strategy to these endpoints, for example validating
Origin/Fetch Metadata or a host-managed anti-forgery mechanism, and must not disable protection for the browser adapter. Endpoint URLs should remain
same-origin when cookie authentication is used; `credentials: "same-origin"` deliberately does not send cookies cross-origin. X-Identity never logs
request headers, credentials, tokens, or server response bodies.

## Related documentation

- [Subsystems](index.md)
- [Identity](70-identity.md)
- [Application Specification](../50-specifications/application.md)
