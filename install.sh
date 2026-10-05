#!/bin/sh
# Install the single-file binary from GitHub Releases (no root needed).
#
#   curl -fsSL https://raw.githubusercontent.com/bipprojectbali/makuro-template/main/install.sh | sh
#
# Env overrides:
#   MAKURO_REPO           owner/repo publishing releases   (default below)
#   MAKURO_VERSION        release tag, e.g. v0.1.0          (default: latest)
#   MAKURO_INSTALL_DIR    target directory                  (default: $HOME/.local/bin)
#   MAKURO_DOWNLOAD_BASE  base URL holding the assets       (mirrors/tests; overrides repo+version)
set -eu

# Must equal "name" in package.json — release assets are <BIN_NAME>-<os>-<arch>.
BIN_NAME="makuro-template"

REPO="${MAKURO_REPO:-bipprojectbali/makuro-template}"
VERSION="${MAKURO_VERSION:-}"
INSTALL_DIR="${MAKURO_INSTALL_DIR:-$HOME/.local/bin}"

fail() {
  echo "error: $*" >&2
  exit 1
}

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) fail "OS tidak didukung: $(uname -s) (hanya Linux dan macOS)" ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) fail "arsitektur tidak didukung: $(uname -m) (hanya x64 dan arm64)" ;;
esac

asset="${BIN_NAME}-${os}-${arch}"
if [ -n "${MAKURO_DOWNLOAD_BASE:-}" ]; then
  base="${MAKURO_DOWNLOAD_BASE%/}"
elif [ -n "$VERSION" ]; then
  base="https://github.com/${REPO}/releases/download/${VERSION}"
else
  base="https://github.com/${REPO}/releases/latest/download"
fi

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -qO "$2" "$1"; }
else
  fail "butuh curl atau wget"
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  fail "butuh sha256sum atau shasum untuk verifikasi checksum"
fi

tmp="$(mktemp -d)"
staged=""
trap 'rm -rf "$tmp" ${staged:+"$staged"}' EXIT INT TERM

echo "Mengunduh ${asset} dari ${base} ..."
download "${base}/${asset}" "${tmp}/${asset}" || fail "gagal mengunduh ${base}/${asset}"
download "${base}/checksums.txt" "${tmp}/checksums.txt" || fail "gagal mengunduh ${base}/checksums.txt"

expected="$(awk -v f="$asset" '$2 == f { print $1 }' "${tmp}/checksums.txt")"
[ -n "$expected" ] || fail "checksums.txt tidak memuat ${asset}"
actual="$(sha256 "${tmp}/${asset}")"
[ "$expected" = "$actual" ] || fail "checksum tidak cocok untuk ${asset} (diharapkan ${expected}, didapat ${actual}) — tidak dipasang"

mkdir -p "$INSTALL_DIR"
chmod 755 "${tmp}/${asset}"
if [ "$os" = darwin ] && command -v xattr >/dev/null 2>&1; then
  # Attribute is usually absent when downloaded via curl; missing attr is not an error.
  xattr -d com.apple.quarantine "${tmp}/${asset}" 2>/dev/null || true
fi
# Stage inside the target dir so the final mv is an atomic rename on the same filesystem.
staged="${INSTALL_DIR}/.${BIN_NAME}.tmp.$$"
cp "${tmp}/${asset}" "$staged"
mv -f "$staged" "${INSTALL_DIR}/${BIN_NAME}"

echo "Terpasang: ${INSTALL_DIR}/${BIN_NAME}"
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *) echo "Peringatan: ${INSTALL_DIR} belum ada di PATH. Tambahkan: export PATH=\"${INSTALL_DIR}:\$PATH\"" ;;
esac
echo
echo "Langkah berikutnya:"
echo "  ${BIN_NAME} init     # siapkan .env dan database"
echo "  ${BIN_NAME} doctor   # periksa kesiapan"
