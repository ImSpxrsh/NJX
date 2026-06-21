# CircleCheck for macOS

A native macOS menu-bar companion app for CircleCheck.

## Requirements

- macOS 13.0 or later
- A running CircleCheck server (local or remote)

## Getting started

1. Open `apps/macos/CircleCheck/` in Xcode (File → Open, select the directory — Xcode detects the Package.swift)
2. Select the `CircleCheck` scheme and your Mac as the target
3. Press Run (⌘R)
4. The app appears in the menu bar with a shield icon
5. Configure the server URL in Settings (⌘,) if not using localhost:3000

## Usage

1. Click the shield icon in the menu bar
2. Paste or type a suspicious message into the text area
3. Press **Check this message** (or ⌘Return)
4. The risk level and action recommendation appear immediately

## Demo mode

If your server runs with `CIRCLECHECK_REPOSITORY_MODE=demo`, high-risk analyses will include a `demoContactUrl` shown in the result view. This link simulates delivery to a trusted contact.

## Settings

| Setting      | Default                 | Description                            |
| ------------ | ----------------------- | -------------------------------------- |
| Server URL   | `http://localhost:3000` | URL of the CircleCheck server          |
| Household ID | Demo UUID               | UUID of the household (demo mode only) |

## Building from command line

```bash
cd apps/macos/CircleCheck
swift build -c release
swift test
```
