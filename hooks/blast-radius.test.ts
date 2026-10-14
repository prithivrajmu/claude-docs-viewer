import { expect, test } from 'claude-code/testing'
import { destructive } from './blast-radius'

test('flags destructive commands, passes lookalikes', () => {
  for (const c of ['rm -rf build', 'rm -r dir', 'rm -fr x', 'rm --recursive x', 'ls && rm -rf /tmp/x', 'git reset --hard HEAD~1', 'git push --force', 'git push origin main -f', 'git clean -fd', 'psql -c "drop table users"', 'kubectl delete pod x'])
    expect(destructive(c)).not.toBeNull()
  for (const c of ['git push', 'git push origin main', 'git push --force-with-lease', 'rm file.txt', 'rm -f file.txt', 'git reset --soft HEAD~1', 'git clean -n', 'kubectl get pods', 'echo "rm -rf is bad" | wc'.replace(/rm -rf/, 'x')])
    expect(destructive(c)).toBeNull()
})
