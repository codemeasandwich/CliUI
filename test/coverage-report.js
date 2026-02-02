#!/usr/bin/env node
/**
 * Coverage Report Generator
 * Generates a markdown coverage report from Node.js test coverage output
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'COVERAGE.md')

/**
 * Convert a file path to clickable markdown links
 * Input: "lib/widget/charts/bar.js"
 * Output: "[lib/](lib/)[widget/](lib/widget/)[charts/](lib/widget/charts/)[bar.js](lib/widget/charts/bar.js)"
 */
function linkifyPath (filePath) {
  const parts = filePath.split('/')
  let accumulated = ''
  const links = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    accumulated = accumulated ? `${accumulated}/${part}` : part
    const isLast = i === parts.length - 1
    const displayPart = isLast ? part : `${part}/`
    const linkTarget = isLast ? accumulated : `${accumulated}/`
    links.push(`[${displayPart}](${linkTarget})`)
  }

  return links.join('')
}

/**
 * Parse coverage data from Node.js test runner stdout
 * Returns array of { file, line, branch, funcs, uncoveredLines }
 */
function parseCoverageOutput (stdout) {
  const lines = stdout.split('\n')
  const coverageData = []
  let inCoverageReport = false

  for (const line of lines) {
    if (line.includes('# start of coverage report')) {
      inCoverageReport = true
      continue
    }
    if (line.includes('# end of coverage report')) {
      inCoverageReport = false
      continue
    }
    if (!inCoverageReport) continue
    if (line.includes('# file | line %')) continue // header line
    if (line.includes('# all files |')) continue // summary line

    // Parse: # file | line % | branch % | funcs % | uncovered lines
    const match = line.match(/^# (.+?) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|(.*)$/)
    if (match) {
      const [, file, linePercent, branchPercent, funcsPercent, uncoveredStr] = match
      const uncoveredLines = uncoveredStr.trim()
        ? uncoveredStr.trim().split(', ').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
        : []

      coverageData.push({
        file: file.trim(),
        line: parseFloat(linePercent),
        branch: parseFloat(branchPercent),
        funcs: parseFloat(funcsPercent),
        uncoveredLines
      })
    }
  }

  return coverageData
}

/**
 * Get content for specific lines from a file
 * Returns array of { lineNumber, content }
 */
function getLineContents (filePath, lineNumbers) {
  const fullPath = path.join(PROJECT_ROOT, filePath)
  try {
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    return lineNumbers.map(num => ({
      lineNumber: num,
      content: lines[num - 1] || ''
    }))
  } catch {
    return lineNumbers.map(num => ({ lineNumber: num, content: '(file not readable)' }))
  }
}

/**
 * Format percentage with color indicator
 */
function formatPercent (value) {
  return `${value.toFixed(2)}%`
}

/**
 * Generate the markdown report
 */
function generateMarkdown (coverageData) {
  // Filter to lib/ files only
  const libFiles = coverageData.filter(d => d.file.startsWith('lib/'))

  // Categorize files
  const missingLines = libFiles.filter(d => d.line < 100)
  const missingOther = libFiles.filter(d => d.line === 100 && (d.branch < 100 || d.funcs < 100))
  const fullyGreen = libFiles.filter(d => d.line === 100 && d.branch === 100 && d.funcs === 100)

  // Calculate overall stats
  const totalLines = libFiles.reduce((sum, d) => sum + d.line, 0) / libFiles.length
  const totalBranch = libFiles.reduce((sum, d) => sum + d.branch, 0) / libFiles.length
  const totalFuncs = libFiles.reduce((sum, d) => sum + d.funcs, 0) / libFiles.length

  let md = ''

  // Header
  md += '# CliUI Coverage Report\n\n'
  md += 'Terminal dashboard widgets for blessed/blessed-contrib.  \n'
  md += 'Auto-generated coverage report from test suite.\n\n'

  // Summary
  md += '## Summary\n\n'
  md += `| Metric | Average |\n`
  md += `|--------|--------|\n`
  md += `| Lines | ${formatPercent(totalLines)} |\n`
  md += `| Branches | ${formatPercent(totalBranch)} |\n`
  md += `| Functions | ${formatPercent(totalFuncs)} |\n\n`

  // Section 1: Missing Line Coverage
  md += '---\n\n'
  md += '## Missing Line Coverage\n\n'
  md += 'Files with less than 100% line coverage. Each uncovered line is listed below the table.\n\n'

  if (missingLines.length === 0) {
    md += '*All files have 100% line coverage!*\n\n'
  } else {
    md += '| File | Lines | Branches | Functions | Uncovered Lines |\n'
    md += '|------|-------|----------|-----------|----------------|\n'
    for (const data of missingLines) {
      const linkedPath = linkifyPath(data.file)
      const uncoveredSummary = data.uncoveredLines.length > 5
        ? `${data.uncoveredLines.slice(0, 5).join(', ')}... (${data.uncoveredLines.length} total)`
        : data.uncoveredLines.join(', ')
      md += `| ${linkedPath} | ${formatPercent(data.line)} | ${formatPercent(data.branch)} | ${formatPercent(data.funcs)} | ${uncoveredSummary} |\n`
    }
    md += '\n'

    // Detailed line content
    md += '### Uncovered Line Details\n\n'
    for (const data of missingLines) {
      md += `#### ${data.file}\n\n`
      const lineContents = getLineContents(data.file, data.uncoveredLines)
      for (const { lineNumber, content } of lineContents) {
        const escapedContent = content.replace(/`/g, "'").replace(/\|/g, '\\|')
        md += `- **Line ${lineNumber}**: \`${escapedContent.trim()}\`\n`
      }
      md += '\n'
    }
  }

  // Section 2: Missing Branch/Function Coverage
  md += '---\n\n'
  md += '## Missing Branch/Function Coverage\n\n'
  md += 'Files with 100% line coverage but missing branch or function coverage.\n\n'

  if (missingOther.length === 0) {
    md += '*No files in this category.*\n\n'
  } else {
    md += '| File | Lines | Branches | Functions |\n'
    md += '|------|-------|----------|----------|\n'
    for (const data of missingOther) {
      const linkedPath = linkifyPath(data.file)
      md += `| ${linkedPath} | ${formatPercent(data.line)} | ${formatPercent(data.branch)} | ${formatPercent(data.funcs)} |\n`
    }
    md += '\n'

    md += '### Details\n\n'
    for (const data of missingOther) {
      const issues = []
      if (data.branch < 100) issues.push(`Branch coverage: ${formatPercent(data.branch)}`)
      if (data.funcs < 100) issues.push(`Function coverage: ${formatPercent(data.funcs)}`)
      md += `- **${data.file}**: ${issues.join(', ')}\n`
    }
    md += '\n'
  }

  // Section 3: Fully Covered Files
  md += '---\n\n'
  md += '## Fully Covered Files\n\n'
  md += 'Files with 100% coverage across all metrics.\n\n'

  if (fullyGreen.length === 0) {
    md += '*No files have 100% coverage across all metrics.*\n\n'
  } else {
    md += '| File | Lines | Branches | Functions |\n'
    md += '|------|-------|----------|----------|\n'
    for (const data of fullyGreen) {
      const linkedPath = linkifyPath(data.file)
      md += `| ${linkedPath} | ${formatPercent(data.line)} | ${formatPercent(data.branch)} | ${formatPercent(data.funcs)} |\n`
    }
    md += '\n'
  }

  // Footer
  md += '---\n\n'
  md += `*Generated: ${new Date().toISOString()}*\n`

  return md
}

/**
 * Main execution
 */
async function main () {
  console.log('Running tests with coverage...\n')

  const testProcess = spawn('node', [
    '--experimental-test-coverage',
    '--test',
    'test/*.test.js'
  ], {
    cwd: PROJECT_ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  })

  let stdout = ''
  let stderr = ''

  testProcess.stdout.on('data', (data) => {
    const text = data.toString()
    stdout += text
    process.stdout.write(text)
  })

  testProcess.stderr.on('data', (data) => {
    const text = data.toString()
    stderr += text
    process.stderr.write(text)
  })

  const exitCode = await new Promise(resolve => {
    testProcess.on('close', resolve)
  })

  if (exitCode !== 0) {
    console.error('\nTests failed. Coverage report not generated.')
    process.exit(exitCode)
  }

  console.log('\nParsing coverage data...')
  const coverageData = parseCoverageOutput(stdout)

  if (coverageData.length === 0) {
    console.error('No coverage data found in test output.')
    process.exit(1)
  }

  console.log(`Found coverage data for ${coverageData.length} files.`)

  console.log('Generating markdown report...')
  const markdown = generateMarkdown(coverageData)

  fs.writeFileSync(OUTPUT_FILE, markdown)
  console.log(`\nCoverage report written to: ${OUTPUT_FILE}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
