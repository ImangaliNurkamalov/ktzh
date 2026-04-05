from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Sequence, TypeVar

T = TypeVar("T")

# Anomaly when (noisy_count / total) * 100 is strictly greater than this.
DEFAULT_NOISY_PERCENT_THRESHOLD = 20.0


def count_noisy(
    items: Sequence[T],
    is_noisy: Callable[[T], bool],
) -> tuple[int, int, int]:
    """
    Classify each item and return (total, noisy_count, healthy_count).
    """
    total = len(items)
    noisy = sum(1 for x in items if is_noisy(x))
    healthy = total - noisy
    return total, noisy, healthy


def noisy_percentage(noisy_count: int, total: int) -> float:
    """Percentage of noisy samples in [0, 100]. Empty window returns 0.0."""
    if total <= 0:
        return 0.0
    return 100.0 * noisy_count / total


@dataclass(frozen=True)
class DetectorAnomalyResult:
    """Outcome of a single detector window analysis."""

    total_samples: int
    noisy_count: int
    healthy_count: int
    noisy_percent: float
    healthy_percent: float
    anomaly_detected: bool
    threshold_percent: float


def analyze_detector_window(
    readings: Sequence[T],
    is_noisy: Callable[[T], bool],
    *,
    noisy_percent_threshold: float = DEFAULT_NOISY_PERCENT_THRESHOLD,
) -> DetectorAnomalyResult:
    """
    Decide whether the detector window shows an anomaly from noisy ratio.

    ``noisy_percent_threshold`` is compared with *strict* inequality:
    anomaly if noisy_percent > threshold (e.g. 20% boundary is not anomalous).
    """
    total, noisy, healthy = count_noisy(readings, is_noisy)
    n_pct = noisy_percentage(noisy, total)
    h_pct = 100.0 - n_pct if total > 0 else 0.0
    anomaly = n_pct > noisy_percent_threshold if total > 0 else False
    return DetectorAnomalyResult(
        total_samples=total,
        noisy_count=noisy,
        healthy_count=healthy,
        noisy_percent=round(n_pct, 4),
        healthy_percent=round(h_pct, 4),
        anomaly_detected=anomaly,
        threshold_percent=noisy_percent_threshold,
    )


# --- Example types and predicates (illustrative only) ---------------------------------


@dataclass(frozen=True)
class ExampleDetectorSample:
    """Synthetic reading for the demo (e.g. one timestep from a detector)."""

    sample_id: int
    signal_value: float


def example_is_noisy(
    sample: ExampleDetectorSample,
    *,
    min_ok: float = 10.0,
    max_ok: float = 90.0,
) -> bool:
    """
    Treat values outside [min_ok, max_ok] as noisy (spike / invalid band).
    """
    return sample.signal_value < min_ok or sample.signal_value > max_ok


def _example_twenty_readings() -> list[ExampleDetectorSample]:
    """20 instances: 15 in-band (healthy), 5 out-of-band (noisy) -> 25% noisy -> anomaly."""
    values = [
        45.0,
        50.0,
        48.0,
        52.0,
        47.0,  # healthy
        120.0,  # noisy
        49.0,
        51.0,
        5.0,  # noisy
        46.0,
        200.0,  # noisy
        50.5,
        48.5,
        -3.0,  # noisy
        47.5,
        49.5,
        51.2,
        99.0,  # noisy (> max_ok 90)
        48.8,
        50.1,
    ]
    return [
        ExampleDetectorSample(sample_id=i + 1, signal_value=v)
        for i, v in enumerate(values)
    ]


def run_example() -> DetectorAnomalyResult:
    """Run the built-in 20-sample scenario and return the analysis."""
    window = _example_twenty_readings()
    return analyze_detector_window(
        window,
        lambda s: example_is_noisy(s),
        noisy_percent_threshold=DEFAULT_NOISY_PERCENT_THRESHOLD,
    )


if __name__ == "__main__":
    result = run_example()
    print("Example: 20 detector samples (healthy band [10, 90])")
    print(f"  Total: {result.total_samples}")
    print(f"  Noisy: {result.noisy_count}, Healthy: {result.healthy_count}")
    print(
        f"  Noisy %: {result.noisy_percent} "
        f"(threshold {result.threshold_percent}%, strict >)"
    )
    print(f"  Anomaly detected: {result.anomaly_detected}")

    # Edge case: exactly 20% noisy (4 of 20) — should not flag with strict >
    four_noisy = [
        ExampleDetectorSample(1, 5.0),
        ExampleDetectorSample(2, 5.0),
        ExampleDetectorSample(3, 5.0),
        ExampleDetectorSample(4, 5.0),
        *[ExampleDetectorSample(i + 5, 50.0) for i in range(16)],
    ]
    edge = analyze_detector_window(four_noisy, lambda s: example_is_noisy(s))
    print()
    print("Edge: 4 noisy / 20 = 20.0% (not above threshold)")
    print(f"  Anomaly detected: {edge.anomaly_detected}")
