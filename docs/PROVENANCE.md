# 源码与授权核验

核验日期：2026-10-19。

Marketplace 项目：<https://marketplace.visualstudio.com/items?itemName=Piyush5784.git-change-highlighter>

其 CHANGELOG 链接指向公开仓库：<https://github.com/Piyush5784/Cusor-Style-Line-Highlighter>

已通过 Git clone 获取公开源码供审查，核验版本：`f8d172568b98a53656dd0a343f1f15da17e32f53`，package.json 版本 `0.0.5`。

该版本 `git ls-tree -r --name-only HEAD` 没有 LICENSE/COPYING 文件，package.json 没有 license 字段，README 没有修改/分发授权声明。公开可读不等于已获得修改、再分发许可，因此本交付采用用户允许的独立轻量扩展路线，没有将该仓库源码纳入产品或源码分发包。工作目录 `upstream/` 仅为核验副本，在 `.vscodeignore` 与源码归档中排除。

审查结论：原实现用内置 Git API `diffWithHEAD`；将新增侧行统一装饰；使用活动编辑器/保存/Git 事件刷新；CodeLens 提供 hunk 计数、Accept、Reject；导航通过状态栏和快捷键；Accept 隐藏、Reject 对磁盘执行逆向 patch。未保存编辑不参与 diff，纯删除只有 CodeLens，没有红色 gutter，且原实现只装饰首个匹配可见编辑器。

独立实现保持上述用户交互目的，使用新的模块、命令命名和扩展身份，实现新增/替换分类、当前缓冲区比较、全部可见编辑器装饰、版本保护，以及显式可撤销的缓冲区 Reject。没有反编译 VSIX，也没有读取或修改 Marketplace 安装目录。

本项目许可证：根目录 LICENSE (MIT)。运行时第三方库 jsdiff (`diff`，MIT) 的许可证随 `node_modules/diff/LICENSE` 打包。开发用 `@vscode/vsce` 不进入 VSIX。

API 参考：<https://code.visualstudio.com/api/references/vscode-api>

jsdiff 官方项目：<https://github.com/kpdecker/jsdiff>
