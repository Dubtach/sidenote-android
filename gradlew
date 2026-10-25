#!/usr/bin/env sh
set -eu
VERSION="8.13"
BASE="${GRADLE_USER_HOME:-$HOME/.gradle}/sidenote-distributions"
HOME_DIR="$BASE/gradle-$VERSION"
ZIP="$BASE/gradle-$VERSION-bin.zip"
SHA256="20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78"
if [ ! -x "$HOME_DIR/bin/gradle" ]; then
  mkdir -p "$BASE"
  echo "Downloading official Gradle $VERSION distribution..."
  curl -fL "https://services.gradle.org/distributions/gradle-$VERSION-bin.zip" -o "$ZIP"
  if command -v sha256sum >/dev/null 2>&1; then
    echo "$SHA256  $ZIP" | sha256sum -c -
  else
    ACTUAL=$(shasum -a 256 "$ZIP" | awk '{print $1}')
    [ "$ACTUAL" = "$SHA256" ] || { echo "Gradle ZIP SHA-256 checksum mismatch." >&2; exit 1; }
  fi
  unzip -q -o "$ZIP" -d "$BASE"
fi
exec "$HOME_DIR/bin/gradle" "$@"
