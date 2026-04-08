Merge the current branch into main and push to remote.

Steps:
1. Run `git branch` and `git status` to confirm the current branch and that there are no uncommitted changes. If there are uncommitted changes, stop and tell the user to commit or stash them first.
2. Note the current branch name (it will be merged into main).
3. Run `git checkout main` to switch to main.
4. Run `git pull origin main` to make sure main is up to date.
5. Run `git merge --no-ff <branch> -m "merge: <branch> into main"` to merge the feature branch.
6. Run `git push origin main` to push to remote.
7. Report the result: which branch was merged, the new HEAD commit, and confirm the push succeeded.

If any step fails, stop and report the error without continuing.
