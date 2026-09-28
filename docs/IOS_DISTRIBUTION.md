# iOS internal distribution

Pull requests compile an unsigned iOS Debug simulator build. Successful `main`
JavaScript CI runs trigger `.github/workflows/ios.yml` to archive the tested
commit once for an iOS device, export a signed IPA, and retain the IPA and dSYMs
as a GitHub artifact for 30 days. A separate job verifies the same IPA and
uploads it to App Store Connect for internal TestFlight testing. iOS distribution
does not gate Android distribution. Maintainers can also dispatch the iOS
workflow manually for the current `main` commit.

An App Store Connect upload is not an App Store release. Apple must finish
processing the build before testers can install it. Assign the build to an
internal TestFlight group, or enable automatic distribution for that group.
Internal testers must be App Store Connect users. The exported build is **not**
marked TestFlight Internal Only, so the same build can later be selected for
external testing or App Store review if the app is ready. External testing can
require Apple's beta review; builds expire after 90 days.

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

The `ios-testflight` environment permits only `main` deployments. It contains:

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
