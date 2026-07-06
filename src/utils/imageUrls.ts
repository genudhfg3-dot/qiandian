const IMAGE_PATH_PATTERN = /^images\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/

export function toAppImageUrl(imagePath: string) {
  const normalized = imagePath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!IMAGE_PATH_PATTERN.test(normalized)) {
    return undefined
  }

  const filename = normalized.slice('images/'.length)
  return `app-image://local/${encodeURIComponent(filename)}`
}

export function rewriteMarkdownImageUrls(markdown: string) {
  return markdown.replace(/(!\[[^\]]*\]\()(images\/[A-Za-z0-9][A-Za-z0-9._-]*\.png)(\))/g, (_match, prefix, imagePath, suffix) => {
    const appImageUrl = toAppImageUrl(imagePath)
    return appImageUrl ? `${prefix}${appImageUrl}${suffix}` : _match
  })
}
