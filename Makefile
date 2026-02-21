# ==========================================
# 使用说明 (Usage Examples):
# 1. 基础更新: make up msg="修复算法逻辑"
# 2. 同步子模块: make sup msg="更新预言机接口"
# 3. 开发新功能: make newup branch=feat/energy msg="新增数据分析"
# 4. 合并并删除: make ship branch=feat/energy msg="完成能源调度优化"
# ==========================================

# --- CONSTANTS (常量定义) ---
# 子模块目录
SUB_PATH = guide
MAIN_BRANCH = main
SECRETS_FILE ?= $(HOME)/.config/dr-agent/secrets.env
SECRETS_DIR := $(dir $(SECRETS_FILE))
RUN_WITH_SECRETS = DR_SECRETS_FILE="$(SECRETS_FILE)" bash scripts/run_with_secrets.sh


.PHONY: help \
	up newup ship sup fullpr-sub fullpr-main sync sync-sub-main new branch-check \
	secrets-init secrets-check api-run demo-run smoke-api-secrets deploy-fuji evidence-judge

# 默认命令：输入 make 就会显示帮助
help:
	@echo "--- 常用命令实例 ---"
	@echo "make up msg='说明文字'          # 提交当前分支"
	@echo "make sup msg='说明文字'         # 先同步子模块再同步主仓库"
	@echo "make newup branch=名 msg='文字'  # 建新分支并推送"
	@echo "make ship branch=名 msg='文字'   # 合并回main并删分支"
	@echo "make fullpr-sub msg='说明文字'  # 第一步：仅提交子模块并创建子模块PR"
	@echo "make fullpr-main msg='说明文字' # 第二步：子模块PR合并后，更新指针并创建主仓库PR"
	@echo "make sync                        # 同步到主仓库记录的子模块提交(可复现)"
	@echo "make sync-sub-main               # 强制拉子模块main最新(会产生gitlink差异)"
	@echo ""
	@echo "--- 外置 secrets（推荐） ---"
	@echo "make secrets-init               # 在工作区外创建 secrets 文件"
	@echo "make secrets-check              # 校验外置 secrets 可读取"
	@echo "make api-run                    # 使用外置 secrets 启动 API"
	@echo "make demo-run                   # 使用外置 secrets 执行闭环演示"
	@echo "make smoke-api-secrets          # 使用外置 secrets 执行 API 冒烟"
	@echo "make deploy-fuji                # 使用外置 secrets 部署 Fuji"
	@echo "make evidence-judge             # 生成评委提交证据包（Markdown）"

# 外置 secrets：在工作区外创建 secrets 文件（默认 ~/.config/dr-agent/secrets.env）
secrets-init:
	@mkdir -p "$(SECRETS_DIR)"
	@if [ -f "$(SECRETS_FILE)" ]; then \
		echo ">>> secrets 已存在: $(SECRETS_FILE)"; \
	else \
		cp .env.example "$(SECRETS_FILE)" && chmod 600 "$(SECRETS_FILE)" && \
		echo ">>> 已创建 secrets: $(SECRETS_FILE)"; \
	fi
	@echo ">>> 请编辑 $(SECRETS_FILE) 并填入真实凭证。"
	@echo ">>> 建议删除工作区内 .env：rm -f .env"

# 校验外置 secrets 可读取（不打印具体内容）
secrets-check:
	@$(RUN_WITH_SECRETS) env >/dev/null
	@echo ">>> [OK] 已成功读取外置 secrets: $(SECRETS_FILE)"

# 使用外置 secrets 启动 API
api-run:
	@$(RUN_WITH_SECRETS) python3 -m uvicorn services.main:app --host 127.0.0.1 --port 8000 --reload

# 使用外置 secrets 执行演示流程
demo-run:
	@$(RUN_WITH_SECRETS) bash scripts/demo_walkthrough.sh

# 使用外置 secrets 执行 API 冒烟
smoke-api-secrets:
	@$(RUN_WITH_SECRETS) python3 scripts/smoke_api_flow.py

# 使用外置 secrets 部署 Fuji
deploy-fuji:
	@$(RUN_WITH_SECRETS) npx hardhat run scripts/deploy_fuji.ts --network fuji

# 生成评委证据包（从部署报告生成 Markdown）
evidence-judge:
	@python3 scripts/build_judge_evidence_bundle.py

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

# 5. 分支安全检查：主/子模块必须同名且非 main，且子模块不能是 detached HEAD
branch-check:
	@set -eu; \
		main_branch=$$(git branch --show-current); \
		sub_branch=$$(git -C $(SUB_PATH) branch --show-current); \
		if [ -z "$$main_branch" ]; then \
			echo "Error: 主仓库当前不是有效分支(可能是 detached HEAD)。"; exit 1; \
		fi; \
		if [ -z "$$sub_branch" ]; then \
			echo "Error: 子模块 $(SUB_PATH) 当前是 detached HEAD。"; \
			echo "请先切到同名功能分支，例如: git -C $(SUB_PATH) switch -c $$main_branch"; exit 1; \
		fi; \
		if [ "$$main_branch" = "$(MAIN_BRANCH)" ] || [ "$$sub_branch" = "$(MAIN_BRANCH)" ]; then \
			echo "Error: 禁止在 $(MAIN_BRANCH) 分支直接修改/提PR。"; exit 1; \
		fi; \
		if [ "$$main_branch" != "$$sub_branch" ]; then \
			echo "Error: 分支不一致: main=$$main_branch submodule=$$sub_branch"; exit 1; \
		fi; \
		echo ">>> [OK] 分支检查通过: $$main_branch"

# 6. 第一步：仅提子模块 PR
fullpr-sub: branch-check
	@if [ -z "$(msg)" ]; then \
		echo "Error: 必须指定 msg='...' (例如: make fullpr-sub msg='close-loop demo')"; exit 1; \
	fi
	@set -eu; \
		work_branch=$$(git branch --show-current); \
		echo ">>> [1/2] 提交并推送子模块分支: $$work_branch"; \
		git -C $(SUB_PATH) add -A; \
		if ! git -C $(SUB_PATH) diff --cached --quiet; then \
			git -C $(SUB_PATH) commit -m "[guide][$$work_branch] $(msg)"; \
		else \
			echo ">>> 子模块无新增变更，跳过提交"; \
		fi; \
		git -C $(SUB_PATH) push -u origin "$$work_branch"; \
		if command -v gh >/dev/null 2>&1; then \
			(cd $(SUB_PATH) && gh pr create --title "[guide][$$work_branch] $(msg)" --body "Auto-created by make fullpr-sub." --base $(MAIN_BRANCH) --head "$$work_branch") || \
			echo ">>> 子模块 PR 已存在或创建失败（可手动处理）"; \
		else \
			echo ">>> 未检测到 gh，跳过子模块 PR 创建"; \
		fi; \
		echo ">>> [2/2] 下一步：等待 guide PR 合并到 main，然后执行 make fullpr-main msg='$(msg)'。"

# 7. 第二步：子模块 PR 合并后，更新主仓库子模块指针并提主仓库 PR
fullpr-main: branch-check
	@if [ -z "$(msg)" ]; then \
		echo "Error: 必须指定 msg='...' (例如: make fullpr-main msg='bump guide pointer')"; exit 1; \
	fi
	@set -eu; \
		work_branch=$$(git branch --show-current); \
		echo ">>> [1/3] 拉取子模块远端 main，并快进当前同名分支到最新 main..."; \
		git -C $(SUB_PATH) fetch origin $(MAIN_BRANCH); \
		git -C $(SUB_PATH) merge --ff-only origin/$(MAIN_BRANCH) || { \
			echo "Error: 子模块分支无法 fast-forward 到 origin/$(MAIN_BRANCH)。"; \
			echo "请先处理 guide 分支历史，再重试 make fullpr-main。"; \
			exit 1; \
		}; \
		echo ">>> [2/3] 提交并推送主仓库全部改动（含子模块指针）..."; \
		git add -A; \
		if git diff --cached --quiet; then \
			echo ">>> 主仓库无可提交改动。若你预期有变化，请确认 guide PR 已合并且主仓库文件已修改。"; \
		else \
			git commit -m "[main][$$work_branch] $(msg)"; \
			git push -u origin "$$work_branch"; \
			if command -v gh >/dev/null 2>&1; then \
				gh pr create --title "[main][$$work_branch] $(msg)" --body "Bump $(SUB_PATH) to latest merged $(MAIN_BRANCH)." --base $(MAIN_BRANCH) --head "$$work_branch" || \
				echo ">>> 主仓库 PR 已存在或创建失败（可手动处理）"; \
			else \
				echo ">>> 未检测到 gh，跳过主仓库 PR 创建"; \
			fi; \
		fi; \
		echo ">>> [3/3] 完成。主仓库 PR 合并后执行 make sync 对齐本地集成态。"

# 7. 同步到主仓库记录的子模块提交（可复现，子模块 detached HEAD 是正常状态）
sync:
	@echo ">>> [1/3] 正在同步主仓库至 $(MAIN_BRANCH)..."
	@git switch $(MAIN_BRANCH)
	@git pull --ff-only origin $(MAIN_BRANCH)
	
	@echo ">>> [2/3] 正在确保子模块对齐主仓库记录提交..."
	@# 注意：此模式追求可复现；子模块会处于 detached HEAD（正常）
	@git submodule sync --recursive
	@git submodule update --init --recursive --checkout --force
	
	@echo ">>> [3/3] 同步完成（集成态）。如需强制拉子模块 main 最新，请执行 make sync-sub-main。"
	@git status

# 8. 强制拉取主仓库 main + 子模块 main 最新（用于子模块独立开发）
# 注意：如果子模块 main 领先主仓库 gitlink，会让主仓库出现 guide 指针变化
sync-sub-main:
	@echo ">>> [1/3] 同步主仓库 $(MAIN_BRANCH)..."
	@git switch $(MAIN_BRANCH)
	@git pull --ff-only origin $(MAIN_BRANCH)
	@echo ">>> [2/3] 同步子模块 $(MAIN_BRANCH)..."
	@git -C $(SUB_PATH) switch $(MAIN_BRANCH)
	@git -C $(SUB_PATH) pull --ff-only origin $(MAIN_BRANCH)
	@echo ">>> [3/3] 完成。若主仓库出现 guide 变更，可 git add guide 后提交 bump 指针。"

# 9. 一键开启新任务：主子模块同步切分支
# 用法: make new branch=feature/your-task-name
new:
	@if [ -z "$(branch)" ]; then \
		echo "Error: 必须指定分支名，例如: make new branch=feat/demo"; exit 1; \
	fi
	@echo ">>> [1/3] 正在同步主子模块至最新状态..."
	@$(MAKE) sync
	
	@echo ">>> [2/3] 正在主仓库创建并切换至分支: $(branch)"
	@if git show-ref --verify --quiet refs/heads/$(branch); then \
		git switch $(branch); \
	else \
		git switch -c $(branch); \
	fi
	
	@echo ">>> [3/3] 正在子模块创建并切换至分支: $(branch)"
	@cd $(SUB_PATH) && \
	if git show-ref --verify --quiet refs/heads/$(branch); then \
		git switch $(branch); \
	else \
		git switch -c $(branch); \
	fi
	
	@echo ">>> [OK] 准备就绪！你现在处于 $(branch) 分支，可以开始开发了。"
