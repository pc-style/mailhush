#!/usr/bin/env bash
set -euo pipefail

repo_dir="/Users/pcstyle/projects/04-Browsers/01-Extensions/mailhush"
chrome_zip="$repo_dir/build/chrome-mv3-prod.zip"
firefox_zip="$repo_dir/build/firefox-mv2-prod.zip"
source_zip="$repo_dir/build/mailhush-source-1.1.1.zip"

message="Do you want to publish MailHush to the Chrome Web Store and Firefox Add-ons today?

Chrome upload:
$chrome_zip

Firefox upload:
$firefox_zip

Firefox source, if requested:
$source_zip"

choice="$(osascript <<APPLESCRIPT
display dialog "$message" buttons {"Later", "Publish now"} default button "Publish now" cancel button "Later" with title "Codex reminder: publish MailHush" with icon note
button returned of result
APPLESCRIPT
)"

if [[ "$choice" != "Publish now" ]]; then
  exit 0
fi

open "https://chrome.google.com/webstore/devconsole"
open "https://addons.mozilla.org/developers/"
open -R "$chrome_zip"
