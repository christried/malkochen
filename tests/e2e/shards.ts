// CI's browser shards (#287). Playwright's own --shard cuts the files, in
// name order, into runs of equal test counts, so the slow files that sort
// first (achievements, affordances, add-dish-from-link) all landed in one
// shard. Here whole files are spread by how long each took
// (durations.json): slowest first, each to the shard with the least time
// so far. A file not measured yet counts as the median one.
//
// durations.json holds each file's seconds, summed from the list reporter's
// lines of a green CI run. Refresh it when the shards drift apart.

// The files shard `index` (from 1) of `total` runs, in name order.
export function planShard(files: string[], durations: Record<string, number>, index: number, total: number): string[] {
  const known = Object.values(durations).toSorted((a, b) => a - b)
  const mid = Math.floor(known.length / 2)
  const median = !known.length ? 1 : known.length % 2 ? known[mid]! : (known[mid - 1]! + known[mid]!) / 2
  const time = (file: string) => durations[file] ?? median
  const shards = Array.from({ length: total }, () => ({ time: 0, files: [] as string[] }))
  for (const file of files.toSorted((a, b) => time(b) - time(a) || a.localeCompare(b))) {
    const least = shards.reduce((min, shard) => shard.time < min.time ? shard : min)
    least.time += time(file)
    least.files.push(file)
  }
  return shards[index - 1]!.files.toSorted()
}
