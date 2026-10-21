import { strict as assert } from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tableUtilOut = resolve(root, '.tmp/verifyMarkdownTable.mjs')
const clipboardOut = resolve(root, '.tmp/verifyClipboardTables.mjs')

await build({
  entryPoints: [resolve(root, 'src/utils/markdownTable.ts')],
  outfile: tableUtilOut,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
})

await build({
  entryPoints: [resolve(root, 'electron/capture/clipboardMarkdown.ts')],
  outfile: clipboardOut,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['turndown'],
  logLevel: 'silent',
})

const { splitTableRow, tryParseTableBlock, buildTableMarkdown } = await import(
  `${pathToFileURL(tableUtilOut).href}?t=${Date.now()}`
)
const { convertClipboardSnapshot } = await import(`${pathToFileURL(clipboardOut).href}?t=${Date.now()}`)

// 1. splitTableRow：普通分隔、转义竖线、首尾竖线可选
assert.deepEqual(splitTableRow('| A | B | C |'), ['A', 'B', 'C'])
assert.deepEqual(splitTableRow('A | B'), ['A', 'B'])
assert.deepEqual(splitTableRow('| 含 \\| 竖线 | 正常 |'), ['含 | 竖线', '正常'])

// 2. buildTableMarkdown：生成标准 GFM 表格，短行补齐空单元格，竖线转义
const built = buildTableMarkdown([
  ['姓名', '部门', '备注'],
  ['张三', '研发', '有 | 特殊字符'],
  ['李四', '产品'],
])
assert.equal(
  built,
  ['| 姓名 | 部门 | 备注 |', '| --- | --- | --- |', '| 张三 | 研发 | 有 \\| 特殊字符 |', '| 李四 | 产品 |  |'].join('\n'),
  'buildTableMarkdown should produce a well-formed GFM table with padded/escaped cells',
)

// 3. tryParseTableBlock：能正确识别表头+分隔行+若干数据行，并在遇到空行/无竖线内容时停止
const lines = ['前言段落', '', '| 姓名 | 部门 |', '| --- | --- |', '| 张三 | 研发 |', '| 李四 | 产品 |', '', '后续段落']
const parsed = tryParseTableBlock(lines, 2)
assert.ok(parsed, 'should detect a table block starting at the header line')
assert.deepEqual(parsed.headerCells, ['姓名', '部门'])
assert.deepEqual(parsed.bodyRows, [
  ['张三', '研发'],
  ['李四', '产品'],
])
assert.equal(parsed.consumedLineCount, 4, 'should consume header + separator + 2 body rows, stopping before the blank line')
assert.equal(tryParseTableBlock(lines, 0), null, 'a plain paragraph must not be misdetected as a table')

// 4. 往返：build 出来的 markdown 再解析回去应该得到同样的单元格内容
const roundTripLines = built.split('\n')
const roundTripParsed = tryParseTableBlock(roundTripLines, 0)
assert.ok(roundTripParsed)
assert.deepEqual(roundTripParsed.headerCells, ['姓名', '部门', '备注'])
assert.deepEqual(roundTripParsed.bodyRows[0], ['张三', '研发', '有 | 特殊字符'], 'escaped pipe should round-trip back to a literal pipe')

// 5. Excel 剪贴板 HTML（典型结构：<table><tr><td>...）经 turndown+gfm 应转换为标准 GFM 表格
const excelHtml = `
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<body>
<table border="0" cellpadding="0" cellspacing="0">
 <tr>
  <td>日期</td>
  <td>事项</td>
  <td>负责人</td>
 </tr>
 <tr>
  <td>7/1</td>
  <td>需求评审</td>
  <td>王琳</td>
 </tr>
 <tr>
  <td>7/2</td>
  <td>联调</td>
  <td>李雷</td>
 </tr>
</table>
</body>
</html>
`
const clipboardResult = convertClipboardSnapshot({ html: excelHtml, text: '日期\t事项\t负责人\n7/1\t需求评审\t王琳\n7/2\t联调\t李雷' })
assert.equal(clipboardResult.format, 'html')
assert.ok(clipboardResult.contentMd.includes('|'), 'Excel table pasted via readClipboard should turn into a piped markdown table, not run-on plain text')
const excelParsed = tryParseTableBlock(clipboardResult.contentMd.split('\n'), 0)
assert.ok(excelParsed, 'the converted markdown should itself be recognized as a valid table block')
assert.deepEqual(excelParsed.headerCells, ['日期', '事项', '负责人'])
assert.equal(excelParsed.bodyRows.length, 2)
assert.deepEqual(excelParsed.bodyRows[1], ['7/2', '联调', '李雷'])

console.log('table support verification passed')
