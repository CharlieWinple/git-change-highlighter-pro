# Git Change Highlighter Pro

独立、轻量的 VS Code 扩展：相对 Git HEAD 显示绿色新增行、蓝色修改行、红色删除位置。默认背景透明度 24%，启动即启用，支持未保存编辑，以及 staged + unstaged 的合并结果。

## 安装

在 VS Code 扩展面板菜单选择 **Install from VSIX…**，选择 `dist/git-change-highlighter-pro-1.0.1.vsix`。也可运行：

```powershell
code --install-extension .\dist\git-change-highlighter-pro-1.0.1.vsix
```

扩展 ID：`local-tools.git-change-highlighter-pro`。请在使用本扩展的工作区禁用原 `Piyush5784.git-change-highlighter`，避免两套背景、CodeLens 和快捷键叠加。这里的 publisher 是本地包标识，并不代表已发布 Marketplace。

要求：VS Code 1.85+、本机 Git、内置 Git 扩展启用、工作区已信任。已实测 VS Code 1.142.0 / Windows。远程工作区应安装在远程扩展宿主；Web/虚拟工作区不支持。

## 使用

- 普通编辑器自动显示绿色新增、蓝色替换、红底白色减号删除标记。删除位置的邻近行末显示 `−N 行` 标签，CodeLens 同时显示删除数量；标签不属于文件内容。纯删除标在删除后的间隙；文件末尾或空文件没有可用行时夹到最后可显示行。
- `Ctrl+Alt+N` / `Ctrl+Alt+P` 跳转下一处/上一处，状态栏显示剩余 hunk 数量。
- CodeLens 的 **Accept** 仅在当前会话隐藏该 hunk，不暂存、不保存。内容或位置改变、HEAD 改变或关闭文档后重新显示。
- **Reject** 撤销整个原始 hunk（含该 hunk 中所有变更），可使用 Ctrl+Z 撤销。只修改缓冲区，不自动保存、不改变暂存区。与原扩展直接 `git apply -R` 的实现不同，这是避免隐式磁盘/Git 写入的设计。
- 命令面板 **Git Change Highlighter Pro: Refresh** 可在自动刷新关闭时手动刷新。

HEAD 与缓冲区最终结果一致时不显示标记，即使暂存区存在被工作区反向抵消的改动。这是 HEAD 基准的预期含义。

## 推荐 settings.json

```json
{
  "gchPro.addedColor": "#00A83B",
  "gchPro.modifiedColor": "#0066FF",
  "gchPro.deletedColor": "#E00032",
  "gchPro.opacity": 0.24,
  "gchPro.wholeLine": true,
  "gchPro.overviewRuler": false,
  "gchPro.deletionLabels": true,
  "gchPro.autoRefresh": true,
  "gchPro.codeLens": true
}
```

颜色使用 `#RRGGBB`；透明度范围 0–1。关闭整行背景仍保留删除 gutter 标记及可选 overview ruler。配置支持按工作区/文件夹覆盖。没有修改文字前景、语法 token、边框或选区设置。VS Code/主题决定各背景层的最终叠加效果；若影响搜索或选区辨识，可调低透明度或关闭整行背景。

完整配置见 `docs/settings.recommended.json`：保留 `scm.diffDecorations: all` 的原生缩略图/编辑器边栏标记，将三个 `editorOverviewRuler.*Foreground` Git 颜色设为透明，并关闭本扩展 overview ruler，从而隐藏最右侧 Git 彩条。其他错误、搜索等概览标记不受影响。`workbench.colorCustomizations` 应合并到现有对象中，不要覆盖已有主题配置。缩略图左侧标记由 VS Code 原生 Git 提供，遵循其 diff 基准，可能与本扩展 HEAD 基准存在区别。

## 构建与测试

源码直接使用 CommonJS JavaScript，无编译步骤。Node.js 22+ 推荐；本次使用 24.14.0。锁文件固定 npm 依赖。

```powershell
npm ci --ignore-scripts
npm run check
npm test
npm run package
# 可选：真实 VS Code 扩展宿主集成测试（需要 code 在 PATH 中）
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-host.ps1
# 验证 VSIX 解包后的实际文件，防止漏打包依赖
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-host.ps1 -Packaged
```

`npm test` 仅在自动创建的临时仓库中执行 Git 写入，结束后清理该仓库；生产扩展仅执行 Git 只读命令。宿主测试在 `gch-host-*` 临时目录及独立 VS Code 配置中运行，并保留临时目录供排查，不接触日常 VS Code 配置。结果见 `docs/TEST-RESULTS.txt`、`docs/HOST-RESULTS.json`。

包由 `@vscode/vsce` 创建，包含 `src/` 和 MIT 授权的 jsdiff 运行时；不包含原扩展源码、测试仓库或开发依赖。源码交付压缩包包含锁文件、测试与文档。

## 实现与性能

`src/git.js` 使用内置 Git API 提供的 Git 路径和仓库根目录，通过只读 `rev-parse`、`diff --name-status -z`、`ls-tree`、`show` 读取 HEAD 内容。绝对路径经仓库相对化，参数不经过 shell，路径按 literal pathspec 处理，NUL 分隔支持空格、Unicode 和换行文件名。

`src/diff.js` 生成并解析 unified diff：上下文推进新旧行计数，no-newline 标记不推进计数；配对仅在连续变更块内部进行，不跨越上下文或 hunk。等长替换顺序配对；不等长块通过有序动态规划及文本二元组相似度辅助配对。无可靠匹配或超过 16,384 对比较时回退顺序配对。着色结果不改写 hunk，Reject 使用原始 hunk 内容。

刷新监听打开、切换、可见编辑器变化、输入、保存和 Git 仓库事件，180 ms debounce；3 秒轮询可见文件兜底捕获外部 commit/HEAD 变化。每个文档至多一个刷新任务；失效代数与文档版本共同拒绝旧结果。相同快照缓存计算结果，HEAD 内容缓存限约 40 MiB；最多两个 diff 工作线程，算法超时 1.5 秒、线程硬限 4 秒、Git 子进程超时 5 秒。大于 5 MiB、二进制或无法计算的文件跳过并写入 Output → Git Change Highlighter Pro，不弹窗。

## 边界与尚未解决的分类歧义

- 文本 diff 无法证明用户编辑意图。删除一行再新增无关一行，与替换一行可能完全等价；等长块按修改显示。
- 不等长块使用相似度阈值 0.35；重复模板、空行、代码移动、完全重写可能有多种合理配对。巨大重写回退顺序配对，可能把实际新增归为修改，或反之。
- Git 能识别的重命名使用旧路径的 HEAD 内容。未暂存的文件系统重命名通常表现为删除 + 未追踪文件；其新路径按新文件处理。低于 Git 相似度阈值的重命名也可能按新文件显示。
- 未追踪文件的所有真实文本行视为 Added；空新文件没有可高亮的行。被删除且未打开的文件没有普通文本编辑器可显示标记；将已打开文件清空时显示红色位置。
- CRLF/LF 差异标准化，不把纯换行格式变化标成全文件修改。内容按 UTF-8 读取 HEAD；非 UTF-8 编码、Git clean/smudge 自定义过滤器、LFS 指针与工作区内容转换暂未适配。
- submodule 内文件取决于内置 Git 是否打开该子仓库。合并冲突显示 HEAD 到缓冲区的普通文本差异，不提供三方冲突语义。
- 独立扩展提供等效交互，不接管原扩展的 command ID，也不迁移其内存 Accept 状态。未进行跨主题人工像素验收或真实多进程窗口压力测试；同文档双编辑器及真实宿主功能已自动验证。

## 源码来源与许可

见源码中的 `docs/PROVENANCE.md`。本项目为独立实现，MIT 许可；不包含、不改写、不重新分发未明确授权的原扩展代码。
