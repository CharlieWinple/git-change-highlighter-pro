# Changelog

## 1.0.2

- 将当前确认配色设为默认值：新增 `#55AA70`、修改 `#5792D0`、删除 `#CE7078`，背景不透明度 15%；同步配置声明和运行时回退值。
- Adopt the approved palette as defaults: added `#55AA70`, modified `#5792D0`, deleted `#CE7078`, with 15% background opacity. Manifest defaults and runtime fallbacks now agree.
- README 更新为中英双语，说明安装、默认配置、原生 Git 左轨标记、构建及已知限制。
- Provide a bilingual Chinese/English README covering installation, defaults, native Git left-lane markers, building, and limitations.

## 1.0.1

- 默认绿色/蓝色改为更鲜明的 `#00A83B` / `#0066FF`，背景透明度提高至 24%。
- 默认关闭扩展 overview ruler；推荐配置保留原生 minimap Git 标记并隐藏最右侧 Git 概览彩条。
- 删除图标改为红底白色减号，增加邻近行末 `−N 行` 标签与 CodeLens 删除数量；可通过 `gchPro.deletionLabels` 关闭行末标签。
- 增加纯删除、混合删除的计数测试及空文件宿主交互测试。
