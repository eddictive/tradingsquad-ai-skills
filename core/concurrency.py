"""Bounded-concurrency worker pool for parallel API fetches."""

from concurrent.futures import ThreadPoolExecutor, as_completed


def map_pool(items, concurrency, worker_fn):
    if not items:
        return []

    limit = max(1, min(concurrency, len(items)))
    results = []

    with ThreadPoolExecutor(max_workers=limit) as executor:
        futures = {executor.submit(worker_fn, item): item for item in items}
        for future in as_completed(futures):
            try:
                value = future.result()
                if value is not None:
                    results.append(value)
            except Exception:
                pass

    return results