# Git Change Highlighter Pro

**中文 / English · v1.0.2**

轻量级 VS Code 扩展：相对 Git **HEAD**，以绿色显示新增行、蓝色显示修改行、红色标识删除位置。默认背景不透明度为 **15%**，覆盖已暂存、未暂存及未保存的编辑器内容，保留代码语法高亮。

A lightweight VS Code extension that highlights changes against Git **HEAD**: green for added lines, blue for modified lines, and red for deletion positions. Default background opacity is **15%**. It covers staged, unstaged, and unsaved buffer changes while preserving syntax highlighting.

## 安装 / Installation

下载：[最新 Release 页面](https://github.com/CharlieWinple/git-change-highlighter-pro/releases/latest) · [直接下载 v1.0.2 VSIX](https://github.com/CharlieWinple/git-change-highlighter-pro/releases/download/v1.0.2/git-change-highlighter-pro-1.0.2.vsix)。无需克隆仓库或自行构建。

Downloads: [Latest Release](https://github.com/CharlieWinple/git-change-highlighter-pro/releases/latest) · [Download v1.0.2 VSIX](https://github.com/CharlieWinple/git-change-highlighter-pro/releases/download/v1.0.2/git-change-highlighter-pro-1.0.2.vsix). No repository clone or local build is required.

下载后，在 VS Code 扩展面板菜单选择 **Install from VSIX…（从 VSIX 安装）**，选择下载的 `git-change-highlighter-pro-1.0.2.vsix`；也可在下载文件所在目录执行以下命令。若从源码仓库安装，文件位于 `dist/`。

After downloading, choose **Install from VSIX…** in VS Code's Extensions view menu and select the downloaded `git-change-highlighter-pro-1.0.2.vsix`. Alternatively, run the command below from the download directory. In a source checkout, the package is located in `dist/`.

```powershell
code --install-extension .\git-change-highlighter-pro-1.0.2.vsix
```

扩展 ID：`local-tools.git-change-highlighter-pro`。按需执行 **Developer: Reload Window**。请禁用原 `Piyush5784.git-change-highlighter`，避免重复高亮、CodeLens 和快捷键。本地包未发布到 Marketplace。

Extension ID: `local-tools.git-change-highlighter-pro`. Run **Developer: Reload Window** if needed. Disable the original `Piyush5784.git-change-highlighter` to avoid duplicate highlights, CodeLens actions, and keybindings. This local package is not published on the Marketplace.

要求：VS Code 1.85+、Git、已启用的内置 Git 扩展、已信任的工作区。已在 Windows / VS Code 1.142.0 验证；最低支持版本及其他平台未实测。远程工作区应安装到远程扩展宿主，Web/虚拟工作区不支持。

Requirements: VS Code 1.85+, Git, the built-in Git extension enabled, and a trusted workspace. Tested on Windows with VS Code 1.142.0; the minimum supported version and other platforms have not been tested. Install in the remote extension host for remote workspaces. Web and virtual workspaces are unsupported.

## 默认配色与配置 / Default colors and settings

| 类型 / Type | 默认颜色 / Default color | 显示方式 / Appearance |
| --- | --- | --- |
| 新增 / Added | `#55AA70` | 绿色整行背景 / Green whole-line background |
| 修改 / Modified | `#5792D0` | 蓝色整行背景 / Blue whole-line background |
| 删除 / Deleted | `#CE7078` | 红色减号及删除数量 / Red minus marker and deleted-line count |

以下为 **1.0.2 的扩展默认值**，无需手动添加即可使用。已有用户/工作区设置优先于默认值；升级不会覆盖自定义配置。

These are the **extension defaults in 1.0.2**; no manual settings are required. Existing user/workspace settings take precedence, so upgrading does not overwrite customizations.

```json
{
  "gchPro.addedColor": "#55AA70",
  "gchPro.modifiedColor": "#5792D0",
  "gchPro.deletedColor": "#CE7078",
  "gchPro.opacity": 0.15,
  "gchPro.wholeLine": true,
  "gchPro.overviewRuler": false,
  "gchPro.deletionLabels": true,
  "gchPro.autoRefresh": true,
  "gchPro.codeLens": true
}
```

颜色格式为 `#RRGGBB`。`opacity` 指**不透明度**：0 完全透明、1 完全不透明；0.15 表示 15% 不透明，即 85% 透明。它控制整行背景和删除标签背景，不改变语法文字颜色。删除图标和标签文字使用所选颜色。关闭 `wholeLine` 可隐藏整行背景，关闭 `deletionLabels` 可隐藏行末删除数量。主题决定背景与选区、搜索结果的最终叠加效果。

Colors use `#RRGGBB`. `opacity` means **opacity**, from 0 (transparent) to 1 (opaque); 0.15 is 15% opaque, or 85% transparent. It controls whole-line and deletion-label backgrounds without changing syntax text colors. Deletion icons and label text use the selected color. Disable `wholeLine` to hide line backgrounds or `deletionLabels` to hide inline counts. The theme determines how backgrounds blend with selections and search results.

### 窄滚动条左侧 Git 标记 / Git markers on the scrollbar's left lane

默认关闭本扩展额外的 overview ruler 染色。要复现当前使用的效果，可合并源码中的 `docs/settings.recommended.json`：保留 `scm.diffDecorations: all`、设置 `editor.overviewRulerLanes: 3`，为原生 Git gutter、minimap 和 overview ruler 配置相同颜色。这样保留窄滚动条左轨的 Git 细色条，避免扩展额外添加右侧色块；代码缩略图仍可显示原生 Git 标记。

Additional extension overview-ruler coloring is disabled by default. To reproduce the current setup, merge `docs/settings.recommended.json` from the source: keep `scm.diffDecorations: all`, set `editor.overviewRulerLanes: 3`, and apply matching colors to native Git gutter, minimap, and overview-ruler markers. This keeps the thin Git strip on the narrow scrollbar's left lane without an additional extension-colored block on the right. Native Git minimap markers remain available.

这些是可选的 **VS Code 原生设置**，扩展安装不会自动改写它们。请合并 `workbench.colorCustomizations`，不要覆盖已有主题配置。原生 Git 标记的 diff 基准可能与本扩展 HEAD 基准不同；错误、搜索等其他标尺标记不由本扩展控制。

These are optional **native VS Code settings**; installation does not rewrite them. Merge `workbench.colorCustomizations` instead of replacing existing theme customizations. The native Git diff baseline can differ from this extension's HEAD baseline. Other ruler markers, such as errors and search matches, are not controlled by this extension.

## 使用 / Usage

| 操作 / Action | 行为 / Behavior |
| --- | --- |
| 自动刷新 / Auto refresh | 打开、切换、编辑、保存及 Git 状态变化后更新。Updates on opening, switching, editing, saving, and Git state changes. |
| 下一处 / 上一处 · Next / Previous | `Ctrl+Alt+N` / `Ctrl+Alt+P`；状态栏显示剩余 hunk 数。The status bar shows the remaining hunk count. |
| Accept | 在当前会话隐藏 hunk，不保存或暂存。内容、位置、HEAD 改变或关闭文档后可重新显示。Hides the hunk without saving or staging; it can reappear after content, position, or HEAD changes, or after closing the document. |
| Reject | 撤销整个原始 hunk，仅编辑缓冲区，支持 Ctrl+Z；不自动保存、不写入 Git index。Reverses the entire original hunk in the buffer, supports Undo, and does not save automatically or modify the Git index. |
| Refresh | 命令面板 **Git Change Highlighter Pro: Refresh**，自动刷新关闭时仍可使用。Available from the Command Palette even when automatic refresh is off. |

删除处显示红底白色减号，邻近行末及 CodeLens 显示 `−N 行`（删除 N 行）。标签不写入文件，也不代表邻近的当前行被删除。EOF 或空文件没有可用行时，标记夹到最后可显示行。

Deletions use a red badge with a white minus. The adjacent line and CodeLens show `−N 行` (N deleted lines). This label is not file content and does not mean the adjacent current line was deleted. At EOF or in an empty file, markers are clamped to the last available display line.

当 HEAD 与缓冲区最终内容一致时，即使 index 中还有被工作区反向抵消的改动，也不显示标记。

When HEAD and the buffer have identical final content, no markers appear, even if the index contains changes that the working tree has reversed.

## 构建与测试 / Build and test

CommonJS JavaScript 源码，无需编译。推荐 Node.js 22+；开发环境为 24.14.0。锁文件固定依赖版本。

The source uses CommonJS JavaScript and requires no compilation. Node.js 22+ is recommended; development used 24.14.0. The lockfile pins dependencies.

```powershell
npm ci --ignore-scripts
npm run check
npm test
npm run package
```

可选的真实 VS Code 宿主测试（Windows，需要 `code` 在 PATH 中）：

Optional real VS Code extension-host tests (Windows, with `code` on PATH):

```powershell
# Source / 源码
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-host.ps1
# Unpacked VSIX / VSIX 解包内容
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-host.ps1 -Packaged
```

单元/集成测试仅在创建的临时仓库中执行 Git 写入，结束后清理。宿主测试使用独立 VS Code 配置及 `gch-host-*` 临时目录，并保留目录供排查。验证范围和各版本结果见 `docs/VALIDATION.md`。

Unit/integration tests perform Git writes only in disposable repositories and clean them up afterward. Host tests use isolated VS Code profiles and `gch-host-*` temporary directories, retained for debugging. See `docs/VALIDATION.md` for verification scope and version-specific results.

VSIX 包含 `src/`、jsdiff 运行时及其 MIT LICENSE，不包含原扩展源码、测试或开发依赖。生产扩展只执行 Git 读取命令；仅显式 Reject 操作编辑缓冲区。

The VSIX includes `src/`, the jsdiff runtime, and its MIT license. It excludes the original extension's source, tests, and development dependencies. Production Git commands are read-only; only an explicit Reject action edits the buffer.

## 实现与性能 / Implementation and performance

通过 `rev-parse`、`diff --name-status -z`、`ls-tree`、`show` 读取 HEAD，工作线程比较缓冲区。unified diff 按 hunk 和连续变更块解析，不跨上下文或 hunk 配对；no-newline 标记不推进行号。着色分类不改变 Reject 使用的原始 hunk。

HEAD is read using `rev-parse`, `diff --name-status -z`, `ls-tree`, and `show`; workers compare it with the buffer. Unified diffs are parsed by hunk and contiguous change block, with no pairing across context or hunks. No-newline markers do not advance line numbers. Color classification does not alter the original hunk used by Reject.

180 ms debounce、3 秒可见文件轮询兜底；版本与失效代数拒绝旧结果。HEAD 缓存约 40 MiB，最多两个 diff 工作线程。算法超时 1.5 秒、线程硬限 4 秒、Git 超时 5 秒。大于 5 MiB、二进制或计算失败的文件跳过，原因写入 Output → Git Change Highlighter Pro，不弹窗。

Refresh uses a 180 ms debounce and a 3-second polling fallback for visible files. Versions and invalidation generations reject stale results. HEAD caching is bounded to roughly 40 MiB, with up to two diff workers. Limits are 1.5 seconds for the algorithm, 4 seconds per worker, and 5 seconds per Git subprocess. Files over 5 MiB, binary files, and failed calculations are skipped with a message in Output → Git Change Highlighter Pro, without popups.

## 限制与分类歧义 / Limitations and classification ambiguity

- **配对 / Pairing:** 文本 diff 无法确定编辑意图。等长替换顺序配对；不等长块使用相似度阈值 0.35 的有序匹配，无可靠匹配或超过 16,384 对比较时回退顺序配对。重复代码、移动、完全重写可能误分类。Text diffs cannot establish intent. Equal-size replacements pair in order; unequal blocks use ordered similarity matching with a 0.35 threshold. No credible matches or more than 16,384 candidate pairs trigger ordinal fallback. Repeated code, moves, and complete rewrites can be ambiguous.
- **重命名 / Renames:** Git 识别的重命名使用旧路径 HEAD；未暂存的文件系统重命名或低相似度重命名可能按新文件处理。Git-detected renames use the old HEAD path; unstaged filesystem renames and low-similarity renames can appear as new files.
- **新建与删除 / New and deleted files:** 未追踪文本行全部为新增；空文件无可染色行；未打开且已删除的文件没有普通编辑器可显示标记。Untracked text lines are added; empty files have no lines to color. Deleted, unopened files have no ordinary editor for markers.
- **编码 / Encoding:** CRLF/LF 标准化，HEAD 按 UTF-8 读取。非 UTF-8、clean/smudge 过滤器及 LFS 转换未适配。CRLF/LF is normalized and HEAD is read as UTF-8. Other encodings, clean/smudge filters, and LFS transformations are not adapted.
- **子模块与冲突 / Submodules and conflicts:** 子模块依赖内置 Git 打开对应仓库；冲突按普通 HEAD 文本差异处理，无三方语义。Submodules depend on the built-in Git extension opening their repository. Conflicts use ordinary HEAD-to-buffer differences without three-way semantics.
- **兼容性 / Compatibility:** 独立命令 ID，不迁移原扩展 Accept 状态。跨主题人工像素验收、多个 VS Code 进程压力测试未完成。Commands have independent IDs and do not migrate the original Accept state. Cross-theme pixel inspection and multi-process VS Code stress testing remain unverified.

## 来源与许可 / Provenance and license

本项目为 MIT 授权的独立实现。审查原公开仓库时未发现明确修改/分发许可证，因此未复制、改写或重新分发其代码。核验记录见 `docs/PROVENANCE.md`；jsdiff 的 MIT 许可证随包保留。

This is an independent implementation under the MIT license. The original public repository did not declare a modification/distribution license when inspected, so its code was not copied, modified, or redistributed. See `docs/PROVENANCE.md` for the audit record. The jsdiff MIT license is retained in the package.
