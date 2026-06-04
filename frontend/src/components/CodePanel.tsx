import { useState, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import {
  FileCode, Terminal, ChevronRight, ChevronDown,
  Folder, FolderOpen, File, FileJson, FileText,
  Coffee, Braces, Hash, Package, Settings, Image,
  GitBranch, Database, Globe, Layers
} from 'lucide-react'
import clsx from 'clsx'

interface Props {
  fileList: string[]
  currentFile: string | null
  content: string
  terminalLines: string[]
  activeTab: 'code' | 'terminal'
  onTabChange: (tab: 'code' | 'terminal') => void
  onFileSelect: (path: string) => void
}

// ── Tree building ────────────────────────────────────────────────────────────

type TreeNode =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'dir'; name: string; children: TreeNode[] }

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const path of paths) {
    const parts = path.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        nodes.push({ kind: 'file', name: part, path })
      } else {
        let dir = nodes.find((n): n is Extract<TreeNode, { kind: 'dir' }> => n.kind === 'dir' && n.name === part)
        if (!dir) {
          dir = { kind: 'dir', name: part, children: [] }
          nodes.push(dir)
        }
        nodes = dir.children
      }
    }
  }

  return sortNodes(root)
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  }).map(n => n.kind === 'dir' ? { ...n, children: sortNodes(n.children) } : n)
}

// ── File icon ────────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.venv', 'venv'])

function FileIcon({ name, size = 13 }: { name: string; size?: number }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const base = name.toLowerCase()

  if (base === 'package.json' || base === 'package-lock.json') return <Package size={size} className="text-yellow-400 shrink-0" />
  if (base === 'tsconfig.json' || base === 'jsconfig.json') return <Settings size={size} className="text-blue-400 shrink-0" />
  if (base === '.gitignore' || base === '.gitattributes') return <GitBranch size={size} className="text-orange-400 shrink-0" />
  if (base === 'dockerfile' || base.startsWith('docker-compose')) return <Layers size={size} className="text-blue-300 shrink-0" />
  if (base === 'readme.md') return <FileText size={size} className="text-blue-300 shrink-0" />

  const map: Record<string, JSX.Element> = {
    ts: <FileCode size={size} className="text-blue-400 shrink-0" />,
    tsx: <FileCode size={size} className="text-blue-300 shrink-0" />,
    js: <FileCode size={size} className="text-yellow-400 shrink-0" />,
    jsx: <FileCode size={size} className="text-yellow-300 shrink-0" />,
    py: <FileCode size={size} className="text-green-400 shrink-0" />,
    go: <FileCode size={size} className="text-cyan-400 shrink-0" />,
    rs: <FileCode size={size} className="text-orange-400 shrink-0" />,
    java: <Coffee size={size} className="text-red-400 shrink-0" />,
    json: <FileJson size={size} className="text-yellow-300 shrink-0" />,
    html: <Globe size={size} className="text-orange-300 shrink-0" />,
    css: <Hash size={size} className="text-blue-400 shrink-0" />,
    scss: <Hash size={size} className="text-pink-400 shrink-0" />,
    md: <FileText size={size} className="text-blue-200 shrink-0" />,
    sql: <Database size={size} className="text-purple-400 shrink-0" />,
    sh: <Braces size={size} className="text-green-300 shrink-0" />,
    yaml: <Settings size={size} className="text-red-300 shrink-0" />,
    yml: <Settings size={size} className="text-red-300 shrink-0" />,
    toml: <Settings size={size} className="text-orange-300 shrink-0" />,
    env: <Settings size={size} className="text-yellow-200 shrink-0" />,
    png: <Image size={size} className="text-purple-300 shrink-0" />,
    jpg: <Image size={size} className="text-purple-300 shrink-0" />,
    svg: <Image size={size} className="text-purple-200 shrink-0" />,
    gif: <Image size={size} className="text-purple-300 shrink-0" />,
  }

  return map[ext] ?? <File size={size} className="text-muted shrink-0" />
}

function FolderIcon({ name, open, size = 13 }: { name: string; open: boolean; size?: number }) {
  const color =
    name === 'src' ? 'text-blue-400' :
    name === 'node_modules' ? 'text-yellow-600' :
    name === 'public' ? 'text-green-400' :
    name === 'dist' || name === 'build' ? 'text-orange-400' :
    name === '.git' ? 'text-orange-600' :
    name === 'components' ? 'text-purple-400' :
    name === 'pages' ? 'text-cyan-400' :
    name === 'api' ? 'text-green-300' :
    name === 'assets' || name === 'images' ? 'text-pink-400' :
    'text-yellow-400'

  return open
    ? <FolderOpen size={size} className={clsx('shrink-0', color)} />
    : <Folder size={size} className={clsx('shrink-0', color)} />
}

// ── Tree node component ──────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  currentFile,
  onFileSelect,
  defaultOpen,
}: {
  node: TreeNode
  depth: number
  currentFile: string | null
  onFileSelect: (path: string) => void
  defaultOpen?: boolean
}) {
  const autoOpen = node.kind === 'dir' && !IGNORED_DIRS.has(node.name)
  const [open, setOpen] = useState(defaultOpen ?? autoOpen)

  const indent = depth * 12

  if (node.kind === 'file') {
    const isActive = currentFile === node.path
    return (
      <button
        onClick={() => onFileSelect(node.path)}
        title={node.path}
        className={clsx(
          'group w-full flex items-center gap-1.5 pr-2 py-[3px] text-[11.5px] rounded transition-colors text-left',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-[#aaa] hover:text-white hover:bg-white/5'
        )}
        style={{ paddingLeft: indent + 8 }}
      >
        <FileIcon name={node.name} size={12} />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  // directory
  const isIgnored = IGNORED_DIRS.has(node.name)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'group w-full flex items-center gap-1 pr-2 py-[3px] text-[11.5px] rounded transition-colors text-left',
          isIgnored ? 'text-[#666] hover:text-[#888]' : 'text-[#ccc] hover:text-white hover:bg-white/5'
        )}
        style={{ paddingLeft: indent + 2 }}
      >
        <ChevronRight
          size={11}
          className={clsx('shrink-0 transition-transform duration-150', open && 'rotate-90')}
        />
        <FolderIcon name={node.name} open={open} size={13} />
        <span className="truncate font-medium">{node.name}</span>
        {isIgnored && <span className="ml-auto text-[9px] text-[#555] pr-1">skip</span>}
      </button>

      {open && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow
              key={child.kind === 'file' ? child.path : child.name + depth}
              node={child}
              depth={depth + 1}
              currentFile={currentFile}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Language detection ───────────────────────────────────────────────────────

function getLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', java: 'java', cpp: 'cpp', c: 'c',
    css: 'css', scss: 'css', html: 'html', json: 'json', md: 'markdown',
    sql: 'sql', sh: 'shell', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  }
  return map[ext || ''] || 'plaintext'
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function CodePanel({
  fileList, currentFile, content, terminalLines,
  activeTab, onTabChange, onFileSelect
}: Props) {
  const tree = useMemo(() => buildTree(fileList), [fileList])
  const [treeOpen, setTreeOpen] = useState(true)

  const fileCount = fileList.length

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-sidebar shrink-0">
        <button
          onClick={() => onTabChange('code')}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
            activeTab === 'code' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
          )}
        >
          <FileCode size={13} />
          {currentFile ? currentFile.split('/').pop() : 'Code'}
        </button>
        <button
          onClick={() => onTabChange('terminal')}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
            activeTab === 'terminal' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'
          )}
        >
          <Terminal size={13} />
          Terminal
          {terminalLines.length > 0 && (
            <span className="w-4 h-4 bg-accent rounded-full text-[9px] text-white flex items-center justify-center">
              {Math.min(terminalLines.length, 9)}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-52 bg-[#161616] border-r border-[#2a2a2a] flex flex-col shrink-0">
          {/* Tree header */}
          <button
            onClick={() => setTreeOpen(o => !o)}
            className="flex items-center gap-1.5 px-2 py-2 text-[11px] font-semibold tracking-widest uppercase text-[#666] hover:text-[#aaa] transition-colors shrink-0"
          >
            {treeOpen
              ? <ChevronDown size={11} />
              : <ChevronRight size={11} />}
            Explorer
            {fileCount > 0 && (
              <span className="ml-auto text-[9px] bg-[#2a2a2a] text-[#888] rounded px-1.5 py-0.5 font-normal tracking-normal">
                {fileCount}
              </span>
            )}
          </button>

          {/* Workspace root */}
          {treeOpen && (
            <div className="flex-1 overflow-y-auto py-1 px-1 scrollbar-thin">
              {tree.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Folder size={24} className="text-[#333] mx-auto mb-2" />
                  <p className="text-[#444] text-[11px]">No files yet</p>
                  <p className="text-[#333] text-[10px] mt-1">Files will appear when the agent creates them</p>
                </div>
              ) : (
                <>
                  {/* Workspace root label */}
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                    <FolderOpen size={13} className="text-yellow-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-[#888] truncate">workspace</span>
                  </div>

                  {tree.map(node => (
                    <TreeNodeRow
                      key={node.kind === 'file' ? node.path : node.name}
                      node={node}
                      depth={1}
                      currentFile={currentFile}
                      onFileSelect={onFileSelect}
                      defaultOpen={node.kind === 'dir' && !IGNORED_DIRS.has(node.name)}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Editor / Terminal */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'code' ? (
            currentFile ? (
              <Editor
                height="100%"
                language={getLanguage(currentFile)}
                value={content}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  padding: { top: 12, bottom: 12 },
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <FileCode size={36} className="text-[#333] mb-3" />
                <p className="text-[#555] text-sm">Select a file to view its contents</p>
                <p className="text-[#444] text-xs mt-1">Files created by the agent will appear in the explorer</p>
              </div>
            )
          ) : (
            <TerminalView lines={terminalLines} />
          )}
        </div>
      </div>
    </div>
  )
}

function TerminalView({ lines }: { lines: string[] }) {
  return (
    <div className="h-full overflow-y-auto bg-[#0d0d0d] p-4 font-mono text-xs">
      {lines.length === 0 ? (
        <div className="flex items-center gap-2 text-muted">
          <span className="text-accent">$</span>
          <span className="opacity-50">Terminal output will appear here when commands run</span>
        </div>
      ) : (
        lines.map((line, i) => (
          <div key={i} className={clsx(
            'leading-5',
            line.startsWith('$') ? 'text-accent font-semibold mt-2' :
            line.toLowerCase().includes('error') ? 'text-red-400' :
            line.toLowerCase().includes('warning') ? 'text-yellow-400' :
            'text-[#ccc]'
          )}>
            {line}
          </div>
        ))
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-accent">$</span>
        <span className="w-2 h-3.5 bg-accent animate-pulse inline-block" />
      </div>
    </div>
  )
}
