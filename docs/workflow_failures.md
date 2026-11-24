# docs/workflow_failures.md

This page is for the situation where a GitHub Actions workflow fails and the
failure does not appear to have anything to do with the code change. It
covers the Maven-based workflows (`10-*`, `11-*`, `12-*`, `13-*`, `18-*`,
`40-*`, `41-*`, `56-*`, `58-*`), which all download dependencies from Maven
Central and share a dependency cache.

It explains:

* How the Maven dependency cache works in this repo (and its limitations)
* How to tell a *transient download failure* from a *poisoned cache*
* How to recover from each
* Options for making the workflows more resilient

## How the Maven cache works in this repo

Every Maven workflow sets up Java like this:

```yaml
- uses: actions/setup-java@v4
  with:
     distribution: ${{ env.JAVA_DISTRIBUTION }}
     java-version-file: ./.java-version
     cache: 'maven'
     cache-dependency-path: 'pom.xml'
```

`cache: 'maven'` tells `setup-java` to save and restore `~/.m2/repository`
(the local Maven repository) using GitHub's Actions cache. The cache key is:

```
setup-java-Linux-x64-maven-<sha256 of pom.xml>
```

Three properties of this mechanism matter for debugging:

1. **The key depends only on `pom.xml`.** Every workflow, on every branch,
   restores the same cache as long as `pom.xml` is unchanged. A new cache is
   created only when `pom.xml` changes.

2. **A cache key is written once and never updated.** The first job to finish
   with a new key saves whatever happens to be in its `~/.m2/repository` at
   that moment. Every later job restores that snapshot; nothing it downloads
   is ever added to the cache.

   In practice, when a change to `pom.xml` lands on `main`, about ten Maven
   workflows start at the same time. The fastest one (typically a job that
   compiles little or nothing, such as the schema check or javadoc) saves the
   cache after about a minute. The slower jobs (unit tests, integration
   tests, pitest) need many more artifacts: test frameworks, surefire and
   failsafe, their JUnit providers, pitest, the frontend plugin, and so on.
   Those are **not in the cache**, so every run of those workflows downloads
   them again from Maven Central. (As of November 2026, a run of the
   integration tests downloads roughly 250 artifacts from Central on every
   run, despite a "cache hit".)

   The consequence: the cache reduces, but does not remove, our dependence on
   Maven Central being up for the full length of every run.

3. **The cache is saved even when the job fails.** `setup-java` saves the
   cache in a post step that runs regardless of job outcome. If the first job
   to use a new key fails part way through dependency download (for example
   because Maven Central was down), the saved cache can contain Maven's
   "failed download" marker files. This is how a cache becomes *poisoned*
   (see below).

You can see which caches exist with:

```
gh cache list --repo ucsb-cs156-f26/proj-courses-f26-02
```

or in the GitHub web UI under **Actions → Caches** (left sidebar, under
"Management").

## Symptom A: transient download failure (most common)

### What it looks like

* The failing step is the `mvn` step, and it fails within a few seconds of
  `[INFO] Scanning for projects...`.
* The log contains lines like:

  ```
  [WARNING] The POM for org.apache.maven.plugins:maven-failsafe-plugin:jar:3.5.6 is missing, no dependency information available
  [WARNING] Failed to retrieve plugin descriptor for org.apache.maven.plugins:maven-compiler-plugin:3.14.1: ...
      Could not find artifact org.apache.maven.plugins:maven-compiler-plugin:jar:3.14.1 in central (https://repo.maven.apache.org/maven2)
  [ERROR] Plugin org.apache.maven.plugins:maven-failsafe-plugin:3.5.6 or one of its dependencies could not be resolved:
  [ERROR]   org.apache.maven.plugins:maven-failsafe-plugin:jar:3.5.6 was not found in https://repo.maven.apache.org/maven2 during a previous attempt. This failure was cached in the local repository and resolution is not reattempted until the update interval of central has elapsed or updates are forced
  ```

  or, for a network-level problem rather than a "not found" response:

  ```
  Could not transfer artifact ... from/to central (https://repo.maven.apache.org/maven2): Connection timed out
  ```

* Many unrelated, well-known artifacts fail at once (compiler plugin, clean
  plugin, resources plugin, ...). A real missing artifact affects one
  coordinate, not a dozen.
* **The same workflow passed a few minutes earlier or later** on the same or
  another branch, with the same cache key. This is the decisive clue.

Do not be misled by the phrase "This failure was cached in the local
repository". When it appears in the *same run* as the `Could not find`
warnings above it, the "previous attempt" was a fraction of a second earlier
in the same Maven invocation. It does not by itself mean the restored cache
was bad.

### Why it happens

Maven asked Central for an artifact and got an error (usually an HTTP 404 or
5xx from the CDN, or a connection failure). Maven Resolver retries connection
errors a few times, but it treats a 404 as authoritative and does not retry.
Short Central/CDN blips of a few seconds are common and usually never appear
on <https://status.maven.org/>.

### How to recover

Re-run the failed job. In the web UI: **Re-run failed jobs** on the run
page. From the command line:

```
gh run rerun <run-id> --repo ucsb-cs156-f26/proj-courses-f26-02 --failed
```

If it passes on the re-run, it was transient. If it fails the same way again,
check Symptom B.

### How to confirm it was transient

```
# All runs of a workflow, most recent first; look for passes around the same time
gh run list --repo ucsb-cs156-f26/proj-courses-f26-02 --workflow 41-integration.yml --limit 20

# Which cache key a particular job restored
gh run view <run-id> --repo ucsb-cs156-f26/proj-courses-f26-02 --job <job-id> --log \
  | grep -E "Cache restored from key|Cache saved|not saving cache"
```

If passing and failing runs restored the **same** key within minutes of each
other, the cache is fine and the failure was transient.

## Symptom B: poisoned cache

### What it looks like

* **Every** run of a Maven workflow fails the same way, across branches, from
  some point in time onward, and re-running does not help.
* The failures start right after a `pom.xml` change was merged (that is,
  right after a new cache key was created).
* The log shows the same `Could not find artifact ... in central` /
  `This failure was cached in the local repository` messages as Symptom A,
  but consistently.
* `gh cache list` shows that the cache for the current `pom.xml` hash was
  created at a time when Maven Central was having trouble, or by a run that
  failed.
* Workflows that do **not** restore the Maven cache (frontend-only workflows)
  are unaffected.

### Why it happens

When Maven fails to download an artifact it writes a marker file next to
where the artifact would live, for example:

```
~/.m2/repository/org/apache/maven/plugins/maven-failsafe-plugin/3.5.6/maven-failsafe-plugin-3.5.6.pom.lastUpdated
```

The marker records the repository URL, the time, and the error. Maven will
not retry that artifact from that repository until the repository's
*update policy* expires (`daily` for Central, meaning "not before the next
midnight UTC") or until updates are forced with `mvn -U`.

If the first job to save a new cache key failed during a Central outage, the
cache snapshot contains those marker files but not the artifacts. Every
later job restores the markers and Maven refuses to retry, even though
Central is back.

Because the policy is `daily`, a poisoned cache often "fixes itself" the next
day, which makes it look even more random. That is also why a poisoned cache
is *not* the explanation when passing and failing runs are interleaved on the
same day with the same key.

### How to recover

Pick one; the first is the cleanest.

1. **Delete the cache.** The next job to run will create a fresh one.

   ```
   gh cache list --repo ucsb-cs156-f26/proj-courses-f26-02
   gh cache delete <cache-id-or-key> --repo ucsb-cs156-f26/proj-courses-f26-02
   # or, to clear everything:
   gh cache delete --all --repo ucsb-cs156-f26/proj-courses-f26-02
   ```

   The same thing can be done in the web UI under **Actions → Caches** (trash
   icon next to each entry). Deleting a cache is safe; the only cost is one
   slower run while it is rebuilt. Note that whichever job finishes first
   after deletion saves the new cache, so the new cache will be as
   incomplete as the old one (see "How the Maven cache works" above). That is
   a performance issue, not a correctness issue.

   Deleting caches needs write access to the repo. If you do not have it, ask
   a staff member.

2. **Change the cache key.** Any change to `pom.xml`, even whitespace or a
   comment, produces a new key. This is a reasonable workaround if you cannot
   delete caches, but it leaves the poisoned entry around until GitHub
   evicts it (caches unused for 7 days are deleted automatically).

3. **Force Maven to retry.** Running Maven with `-U` ignores the cached
   failures. For a one-off, dispatch the workflow manually after temporarily
   adding `-U` to the `mvn` command on a branch, or add a step before the
   `mvn` step that deletes the marker files:

   ```yaml
   - name: Remove stale Maven failure markers
     run: find ~/.m2/repository -name '*.lastUpdated' -delete
   ```

   This step is harmless to leave in permanently, and is one of the
   resilience options below.

## Symptom C: Playwright / Ubuntu version mismatch (not a cache issue)

The two integration-test workflows (`11-backend-integration.yml` and
`41-integration.yml`) use Playwright, which fails on Ubuntu releases that it
does not yet know about (for example when `ubuntu-latest` moves to
`ubuntu-26.04`). Those two workflows therefore use

```yaml
runs-on: ${{ vars.PLAYWRIGHT_RUNS_ON || 'ubuntu-latest' }}
```

so that the organization variable `PLAYWRIGHT_RUNS_ON` (currently
`ubuntu-24.04`) can pin them to a known-good image. See the commit "Use
PLAYWRIGHT_RUNS_ON variable for integration workflow runners" and the issue it
closes.

The symptom of *this* problem is a Playwright error about an unsupported
Linux distribution or missing browser dependencies during the test run, not a
Maven resolution error. If you see the Maven errors from Symptom A or B, the
Ubuntu version is not the cause. You can check which image a job actually ran
on in its log: the "Set up job" step prints `Image: ubuntu-24.04` (and an
image build number under "Runner Image Provisioner"). GitHub rolls out new
builds of the same image gradually, so two jobs started minutes apart can get
different build numbers; this is normal and is not something a workflow can
pin.

## Making the workflows more resilient

None of these are in place yet (as of November 2026). They are listed from
least to most invasive. Items 1 and 2 go in the workflow files; items 3 and 4
touch `pom.xml` or Maven configuration and so affect developer machines too.

### 1. Retry the Maven step on resolution failures (workflow)

Maven itself will not retry a 404. A small wrapper in the workflow can:

```yaml
- name: Run IT tests with maven
  run: |
    for attempt in 1 2 3; do
      if INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify \
           2>&1 | tee mvn.log; then
        exit 0
      fi
      if grep -qE "Could not (find|transfer) artifact" mvn.log; then
        echo "::warning::Dependency download failed (attempt $attempt); clearing markers and retrying"
        find ~/.m2/repository -name '*.lastUpdated' -delete
        sleep 20
      else
        exit 1   # a real test/compile failure; do not retry
      fi
    done
    exit 1
```

Only download failures are retried; genuine test failures still fail fast.
The `find ... -delete` is what makes the retry effective (otherwise Maven
would reuse its own cached "not found").

A cheaper variant is to add a separate step before the tests that resolves
dependencies and plugins with a retry (for example with the
`nick-fields/retry` action), so the long test step itself is never repeated.
This does not catch artifacts that plugins resolve lazily at run time (for
example surefire/failsafe JUnit providers), so it is less complete.

### 2. Make the cache complete and per-workflow (workflow)

The cache is incomplete because all workflows share one key and the fastest
job wins. Giving each workflow its own key fixes this. `setup-java` hashes
every file matched by `cache-dependency-path`, so including the workflow
file itself gives each workflow a distinct key:

```yaml
- uses: actions/setup-java@v4
  with:
     distribution: ${{ env.JAVA_DISTRIBUTION }}
     java-version-file: ./.java-version
     cache: 'maven'
     cache-dependency-path: |
       pom.xml
       .github/workflows/41-integration.yml
```

Each workflow's first run then saves exactly the artifacts that workflow
needs, and later runs download nothing from Central under normal conditions.
Costs: roughly 100-300 MB of cache per Maven workflow (the repo limit is
10 GB), and each workflow rebuilds its cache from scratch when either file
changes.

To avoid saving a poisoned cache in the first place, add a cleanup step that
runs even on failure, before `setup-java`'s post step saves the cache:

```yaml
- name: Remove Maven failure markers before cache save
  if: always()
  run: find ~/.m2/repository -name '*.lastUpdated' -delete
```

### 3. Add a fallback repository (pom.xml)

Tracked upstream as <https://github.com/ucsb-cs156/proj-courses/issues/375>,
which also covers the jitpack change below.

There is no official second host for Maven Central, but Google maintains a
public read-only mirror of it:

```
https://maven-central.storage-download.googleapis.com/maven2/
```

Maven does fall back between repositories: if an artifact is "not found" in
one repository it asks the next. So declaring the mirror as an additional
`<repository>` and `<pluginRepository>` in `pom.xml` gives a second chance
on 404s. Two caveats:

* Repositories declared in the POM are consulted **before** `central` (which
  comes from Maven's super-POM), so the mirror would effectively become the
  primary source, with Central as the fallback. The Google mirror can lag a
  few minutes behind Central for brand-new releases; that does not matter
  for this project.
* This belongs in `pom.xml`, not in the workflow, if you want local
  developer builds to benefit too. If you want it CI-only, put it in a
  `<profile>` activated by the `CI` environment variable (GitHub Actions
  sets `CI=true`). A `<mirror>` in a `settings.xml` is **not** the right
  tool: a mirror *replaces* Central rather than adding a fallback.

Relatedly, `pom.xml` currently declares `https://jitpack.io` as a repository
for one dependency. Because POM repositories are consulted first, Maven asks
jitpack for **every** artifact not in the local cache (you can see
`Downloading from jitpack.io: ...junit-jupiter...` lines in the logs) before
falling through to Central. That adds latency and a second third-party
service that can fail. Maven Resolver's remote repository filtering
(`.mvn/maven.config` with `-Daether.remoteRepositoryFilter.groupId=true` and
a `.mvn/rrf/groupId-jitpack.io.txt` listing the one groupId) restricts
jitpack to the artifacts it actually hosts.

### 4. Pre-populate everything in one go (pom.xml / workflow)

`mvn dependency:go-offline` is the usual suggestion but is known to miss
artifacts that plugins resolve dynamically. If item 2 is adopted, a normal
run of each workflow already populates its own cache completely, so this is
not needed.

## Quick triage checklist

1. Does the failing step fail within seconds, with `Could not find artifact`
   / `Could not transfer artifact` for several well-known artifacts?
   → Dependency download problem, not code. Continue.
2. Did the same workflow pass within the last hour or so, with the same
   cache key? → **Transient** (Symptom A). Re-run.
3. Is every Maven workflow failing since a `pom.xml` change was merged, and
   does re-running not help? → **Poisoned cache** (Symptom B). Delete the
   cache.
4. Is the error from Playwright about the Linux distribution? → Symptom C.
   Check `PLAYWRIGHT_RUNS_ON`.
