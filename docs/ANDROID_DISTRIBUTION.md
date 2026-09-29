# Android testing distribution

PR and `main` CI do not distribute builds. An organization owner creates a tag
such as `v1.0.0-rc.1` on a commit already on `main` with successful `main` CI.
The tag automatically triggers `.github/workflows/android-distribution.yml`
and the independent iOS TestFlight workflow. The Android workflow builds the
tagged commit once as a signed, minified universal
APK, retains the APK and release notes as a GitHub artifact for 30 days, and
passes that same verified APK to a separate job for Firebase App Distribution.
iOS distribution does not gate Android testing delivery. Tags may not be
replaced or reused; wait for the tagged commit's `main` CI to pass before
creating one. The tag names a release candidate, not a production release.

Pull requests never receive distribution credentials. Their Android CI build
uses the checked-in Firebase stub and debug signing as a compile gate.

## Firebase

The Firebase Android app must use package `dev.barrelmaker.obscura`. Enable App
Distribution, create a tester group, and add each tester's Google account.

Download the real `google-services.json` for local push testing. Keep it at
`android/app/google-services.json`; the file is gitignored.

## Signing key

Create one long-lived release key and keep an encrypted backup outside the
repository:

```bash
mkdir -p ~/.config/obscura
keytool -genkeypair -v \
  -keystore ~/.config/obscura/android-release.p12 \
  -storetype PKCS12 \
  -alias obscura-release \
  -keyalg RSA -keysize 4096 -validity 10000
```

Use the same store and key password for PKCS12. Every distributed APK must use
this identity so it can update an existing installation.

For a local signed build, create ignored `android/keystore.properties`:

```properties
storeFile=/absolute/path/to/android-release.p12
storePassword=...
keyAlias=obscura-release
keyPassword=...
```

Then run:

```bash
just android-distribution 1 1.0.0-test.1
```

Unlike `just android-release`, this command fails if signing, version metadata,
or the real Firebase configuration is missing.

## GitHub testing environment

The `testing` environment is restricted to release-candidate tags (`v*`).
The workflow validates the full `vX.Y.Z-rc.N` format, the tag target on `main`,
and successful `main` CI before either build or delivery can access the
signing secrets.

Configure these environment variables:

| Variable | Purpose |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full Google workload identity provider resource name. |
| `GCP_SERVICE_ACCOUNT` | Dedicated distribution service-account email. |
| `FIREBASE_ANDROID_APP_ID` | Firebase Android App ID. |
| `FIREBASE_TESTER_GROUP` | Firebase App Distribution group alias. |

Configure these environment secrets:

| Secret | Purpose |
|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | Base64-encoded real Firebase Android configuration. |
| `ANDROID_RELEASE_KEYSTORE_BASE64` | Base64-encoded PKCS12 signing key. |
| `ANDROID_RELEASE_STORE_PASSWORD` | PKCS12 password. |
| `ANDROID_RELEASE_KEY_ALIAS` | Signing alias, normally `obscura-release`. |
| `ANDROID_RELEASE_KEY_PASSWORD` | PKCS12 password. |

The build job validates the Firebase package and App ID before building and
never writes signing credentials outside runner-temporary or ignored paths.
The delivery job receives only the retained APK and release notes, verifies
the APK checksum and tested commit, then authenticates to Google Cloud.

## Google authentication

Use GitHub's OpenID Connect token with Google Workload Identity Federation.
Restrict the provider to `obscura-messaging/obscura-pix`, grant the repository principal
`roles/iam.workloadIdentityUser` on a dedicated service account, and grant that
service account `roles/firebaseappdistro.admin` in the Firebase project.

The provider's attribute condition must require all three claims:

```text
assertion.repository == 'obscura-messaging/obscura-pix' &&
assertion.ref.matches('^refs/tags/v[0-9]+[.][0-9]+[.][0-9]+-rc[.][1-9][0-9]*$') &&
assertion.workflow_ref == 'obscura-messaging/obscura-pix/.github/workflows/android-distribution.yml@' + assertion.ref
```

Use `workflow_ref`, not `job_workflow_ref`: the latter is only present for jobs
using a reusable workflow. The condition must match the exact tagged workflow
as well as the tag pattern; a repository-only condition is too broad.

Do not create a long-lived service-account JSON key for GitHub Actions.

## Installing a build

Firebase emails newly added testers an invitation. After accepting it, a tester
can install the latest build from the Firebase App Tester page. Later builds
signed with the same key update the existing app.

The workflow summary links to the retained GitHub artifact as a fallback.
Retry a failed job from the same tag/run; for a new candidate, create a new
tag rather than moving or deleting a published tag.
