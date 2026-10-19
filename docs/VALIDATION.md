# 验证结果

日期：2026-10-19；Windows、Node.js 24.14.0、VS Code 1.142.0。

- `npm run check`：通过，全部生产 JS 语法检查通过。
- `npm test`：17/17 通过；原始输出见 `TEST-RESULTS.txt`。
- 真实 Git 临时仓库覆盖无 HEAD、新建文件、staged + unstaged、unstage、commit、rename、Unicode/空格路径，核验刷新前后 index 字节及 status 不变。
- 分类测试覆盖纯新增、单/多行替换、混合添加与修改、纯删除（顶部/中间/EOF/整个文件）、邻近与分离 hunks、上下文偏移、no-newline 标记、以 `+++`/`---` 开头的真实内容、CRLF、空文件、二进制拒绝、歧义回退。
- 异步测试覆盖旧任务运行期间连续编辑、debounce 合并、多文档隔离、关闭文档后不发布旧结果。
- 每种语言 40,000 行的 MATLAB/Python/LaTeX 测试通过；本次计算分别约 54/44/53 ms（不含 Git 子进程和工作线程启动，不代表所有机器或极端重写性能）。
- 真实 VS Code 宿主 10 个场景通过；结果见 `HOST-RESULTS.json`。分别对工作区源码和 VSIX 解包后的扩展运行，均通过。包含打开刷新、导航、Accept、未保存编辑、双编辑器、Reject 不保存且 index 不变、Undo、保存和外部 commit、关闭自动刷新后手动刷新。
- `npm run package`：通过。包内包含 `src/worker.js`、`node_modules/diff` 及其 MIT LICENSE；不含 upstream、测试及开发依赖。
- 依赖更新后的 `npm install` 审计报告：0 vulnerabilities；生产依赖 `diff@8.0.4`，工具版本固定在 package-lock.json。

尚未验证：真实多个 VS Code 进程之间的压力测试、跨主题人工像素验收、最低支持版本 1.85 的宿主运行、非 Windows 平台。VS Code 公共 API 不提供已应用 decorations 的查询接口，因此宿主测试验证激活与交互，不冒称自动完成颜色像素验收。

手动视觉验收建议：禁用原扩展、安装 VSIX，分别在浅色/深色主题打开 Git 仓库文件；插入一行、替换一行、删除一行，检查绿色/蓝色整行背景及红色 gutter；进行选择、搜索和当前行移动；分屏显示同文件；外部 stage/unstage/commit 后观察标记。无需修改项目源码即可先在测试脚本创建的临时仓库内进行。
