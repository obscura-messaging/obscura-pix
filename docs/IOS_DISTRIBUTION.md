# iOS internal distribution

Pull requests compile an unsigned iOS Debug simulator build; ordinary `main`
pushes run JavaScript CI without distributing to testers. An Obscura owner
selects **Actions → Release internal build → Run workflow** on `main` after
`main` CI succeeds. That workflow verifies the initiator, selected commit,
and CI result before calling `.github/workflows/ios.yml` to archive the commit
once for an iOS device, export a signed IPA, and retain the IPA and dSYMs as
a GitHub artifact for 30 days. A separate job
verifies the same IPA and uploads it to App Store Connect for internal TestFlight.
Android distribution runs independently. No tag or production release is created.

The internal marketing version remains `1.0` and the build number is 1000
plus the release workflow run number, avoiding collisions with previously
uploaded builds. An already-uploaded build cannot be replaced under the same
version/build number; retry a failed upload job, or start a new release run.
A future store release needs a deliberate version and promotion flow.

An App Store Connect upload is not an App Store release. Apple must finish
processing the build before testers can install it. Assign the build to an
internal TestFlight group, or enable automatic distribution for that group.
Internal testers must be App Store Connect users. The exported build is **not**
marked TestFlight Internal Only, so the same build can later be selected for
external testing or App Store review if the app is ready. External testing can
require Apple's beta review; builds expire after 90 days.

The Account Holder completed Apple's export-compliance questionnaire for the
first build, and App Store Connect recorded `usesNonExemptEncryption: false`.
`ITSAppUsesNonExemptEncryption = NO` in `Info.plist` reflects that determination
for subsequent uploads. Revisit the determination before distributing builds
if the app's encryption or applicable requirements change; the build pipeline
must not guess an exemption.

## Apple signing

The bundle ID is `dev.barrelmaker.obscura`, on Apple team `KY4LCG34B8`, with
App Group `group.dev.barrelmaker.obscura`. Release archives use an Apple
Distribution certificate and the `Obscura App Store` provisioning profile.
Development certificates are for local devices, not TestFlight uploads.

Back up the encrypted distribution identity outside GitHub and keep its export
password separately in a password manager. Renew the certificate and profile
before they expire. Keep the App Store Connect API key separately; it
authenticates the upload and does not sign the app. Never commit a private key,
profile, or Firebase client configuration.

On a Mac with the matching distribution identity and profile installed,
`just ios-archive` builds a signed device archive. The recipe prepares the
pinned libsignal **device** FFI, Swift package, and CocoaPods dependencies; the
ordinary `just ios-build` recipe still prepares the simulator FFI.

## GitHub environment

The `ios-testflight` environment permits only `main` deployments. The
manually dispatched workflow checks the initiating and rerunning actor,
current `main` commit, and successful `main` CI before the signing or upload
jobs start. It contains:

| Variable | Purpose |
|---|---|
| `APPLE_TEAM_ID` | Apple signing team ID. |
| `APPLE_BUNDLE_ID` | Exact app bundle identifier. |
| `APPLE_APP_ID` | Numeric App Store Connect app ID. |
| `APP_STORE_CONNECT_KEY_ID` | Upload API key ID. |
| `APP_STORE_CONNECT_ISSUER_ID` | Upload API issuer ID. |

| Secret | Purpose |
|---|---|
| `IOS_DISTRIBUTION_P12_BASE64` | Base64-encoded, password-protected Apple Distribution identity. |
| `IOS_DISTRIBUTION_PASSWORD` | Export password for that identity. |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded App Store Connect distribution profile. |
| `APP_STORE_CONNECT_API_KEY_P8` | App Store Connect upload private key. |

The archive job loads the certificate into a temporary keychain and verifies
the profile, bundle ID, App Group, and exported IPA metadata. The upload job
receives only the retained artifact and its checksum, plus the upload API key.
Pull requests never receive either job's credentials.

## Limitations

This pipeline distributes a foreground-capable build, **not** iOS push parity.
Firebase Messaging, APNs provisioning, background wakes, and notification
privacy still need real-device implementation and testing; see
[`IOS_PARITY.md`](IOS_PARITY.md) and
[`PUSH_NOTIFICATIONS.md`](PUSH_NOTIFICATIONS.md). Both app hosts currently use
the live Obscura server, including internal tester builds.
