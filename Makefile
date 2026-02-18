# ==========================================
# 使用说明 (Usage Examples):
# 1. 基础更新: make up msg="修复算法逻辑"
# 2. 同步子模块: make sup msg="更新预言机接口"
# 3. 开发新功能: make newup branch=feat/energy msg="新增数据分析"
# 4. 合并并删除: make ship branch=feat/energy msg="完成能源调度优化"
# ==========================================

# --- CONSTANTS (常量定义) ---
SUB_PATH = guide  # 改成你真实的文件夹名
MAIN_BRANCH = main


.PHONY: help up newup ship sup

# 默认命令：输入 make 就会显示帮助
help:
	@echo "--- 常用命令实例 ---"
	@echo "make up msg='说明文字'          # 提交当前分支"
	@echo "make sup msg='说明文字'         # 先同步子模块再同步主仓库"
	@echo "make newup branch=名 msg='文字'  # 建新分支并推送"
	@echo "make ship branch=名 msg='文字'   # 合并回main并删分支"

# 1. 基础提交
up:
	@if [ -z "$(msg)" ]; then echo "Error: 请输入 msg='说明文字'"; exit 1; fi
	@BRANCH=$$(git symbolic-ref --short HEAD); \
	git add -A && \
	git commit -m "[$$BRANCH] $(msg)" && \
	git push

# 2. 新分支提交
newup:
	@if [ -z "$(branch)" ] || [ -z "$(msg)" ]; then echo "Error: 请指定 branch= 和 msg="; exit 1; fi
	@git checkout -b $(branch) && \
	git add -A && \
	git commit -m "$(msg)" && \
	git push -u origin $(branch)

# 3. 洁癖版交付
ship:
	@if [ -z "$(branch)" ] || [ -z "$(msg)" ]; then echo "Error: 请指定 branch= 和 msg="; exit 1; fi
	@git checkout $(MAIN_BRANCH) && git pull && \
	git checkout -b $(branch) && \
	git add -A && \
	git commit -m "$(msg)" && \
	git push -u origin $(branch) && \
	git checkout $(MAIN_BRANCH) && \
	git merge --ff-only $(branch) && \
	git push origin $(MAIN_BRANCH) && \
	git branch -d $(branch) && \
	git push origin --delete $(branch)

# 4. 子模块+主仓库一键提交
sup:
	@if [ -z "$(msg)" ]; then echo "Error: 请输入 msg='说明文字'"; exit 1; fi
	@echo ">>> 正在同步子模块..."
	@cd $(SUB_PATH) && \
	git add -A && \
	if git diff --cached --quiet; then \
		echo ">>> 子模块无变更，直接 push 当前分支"; \
		git push; \
	else \
		git commit -m "[Submodule] $(msg)" && git push; \
	fi
	@echo ">>> 正在同步主仓库..."
	@git add -A && \
	if git diff --cached --quiet; then \
		echo ">>> 主仓库无变更，直接 push 当前分支"; \
		git push; \
	else \
		$(MAKE) up msg="chore: sync submodule - $(msg)"; \
	fi

# 5. 强制分支版：必须在非 main 分支才能提交，完成后强制回到 main
fullpr:
	@if [ -z "$(msg)" ]; then \
		echo "Error: 必须指定 msg='...' (例如: make fullpr msg='完成演示代码')"; exit 1; \
	fi
	
	@# 1. 自动探测分支并锁定
	$(eval CUR_BRANCH := $(shell git rev-parse --abbrev-ref HEAD))
	$(eval CUR_SUB_BRANCH := $(shell cd $(SUB_PATH) && git rev-parse --abbrev-ref HEAD))
	
	@# 2. 安全检查：禁止在 main 执行
	@if [ "$(CUR_BRANCH)" = "$(MAIN_BRANCH)" ] || [ "$(CUR_SUB_BRANCH)" = "$(MAIN_BRANCH)" ]; then \
		echo "Error: 严禁在 $(MAIN_BRANCH) 分支直接提交 PR。"; \
		echo "请先手动切至功能分支 (如: git checkout -b feature/demo)"; exit 1; \
	fi
	
	@echo ">>> [探测成功] 准备提交分支: $(CUR_BRANCH) | 提交信息: $(msg)"
	
	@# 3. 处理子模块
	@cd $(SUB_PATH) && \
		git add -A && \
		(if ! git diff --cached --quiet; then \
			git commit -m "[Submodule] $(msg)" && \
			git push origin $(CUR_SUB_BRANCH) && \
			gh pr create --title "[Submodule] $(msg)" --body "Automated" --base $(MAIN_BRANCH) || echo "PR已存在"; \
		else echo ">>> 子模块无变更"; fi) && \
		git checkout $(MAIN_BRANCH) && git pull origin $(MAIN_BRANCH)

	@# 4. 处理主仓库
	@git add -A && \
		(if ! git diff --cached --quiet; then \
			git commit -m "[Main] $(msg)" && \
			git push origin $(CUR_BRANCH) && \
			gh pr create --title "[Main] $(msg)" --body "Automated" --base $(MAIN_BRANCH) || echo "PR已存在"; \
		else echo ">>> 主仓库无变更"; fi) && \
		git checkout $(MAIN_BRANCH) && git pull origin $(MAIN_BRANCH)

# 6. 同时拉取主子仓库 main 分支并更新
sync:
	@echo ">>> [1/2] 正在同步主仓库至 $(MAIN_BRANCH)..."
	@git checkout $(MAIN_BRANCH)
	@git pull origin $(MAIN_BRANCH)
	
	@echo ">>> [2/2] 正在确保所有子模块同步并切换至 $(MAIN_BRANCH)..."
	@# 1. 先初始化并更新指针内容
	@git submodule update --init --recursive
	@# 2. 强制每个子模块切换到 main 并对齐远端
	@git submodule foreach 'git checkout $(MAIN_BRANCH) && git fetch origin $(MAIN_BRANCH) && git reset --hard origin/$(MAIN_BRANCH)'
	
	@echo ">>> 同步完成！主仓库与所有子模块均已回到 $(MAIN_BRANCH) 并对齐远端。"
	@git status

# 7. 一键开启新任务：主子模块同步切分支
# 用法: make new branch=feature/your-task-name
new:
	@if [ -z "$(branch)" ]; then \
		echo "Error: 必须指定分支名，例如: make new branch=feat/demo"; exit 1; \
	fi
	@echo ">>> [1/3] 正在同步主子模块至最新状态..."
	@$(MAKE) sync
	
	@echo ">>> [2/3] 正在主仓库创建并切换至分支: $(branch)"
	@git checkout -b $(branch)
	
	@echo ">>> [3/3] 正在子模块创建并切换至分支: $(branch)"
	@cd $(SUB_PATH) && git checkout -b $(branch)
	
	@echo ">>> [OK] 准备就绪！你现在处于 $(branch) 分支，可以开始开发了。"