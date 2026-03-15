"""TDD tests for async task queue abstraction.

Tests the task queue service that manages background chain confirmation
and cross-chain relay tasks, with pluggable backends (in-memory for
testing, Redis/Celery for production).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.task_queue import (
    Task,
    TaskStatus,
    TaskQueue,
    InMemoryTaskQueue,
    TaskType,
)


# ---------------------------------------------------------------------------
# TaskType and TaskStatus
# ---------------------------------------------------------------------------

class TestTaskType:
    def test_confirm_tx(self):
        assert TaskType.CONFIRM_TX.value == "confirm_tx"

    def test_bridge_relay(self):
        assert TaskType.BRIDGE_RELAY.value == "bridge_relay"

    def test_icm_deliver(self):
        assert TaskType.ICM_DELIVER.value == "icm_deliver"

    def test_settle_event(self):
        assert TaskType.SETTLE_EVENT.value == "settle_event"


class TestTaskStatus:
    def test_values(self):
        assert TaskStatus.PENDING.value == "pending"
        assert TaskStatus.RUNNING.value == "running"
        assert TaskStatus.COMPLETED.value == "completed"
        assert TaskStatus.FAILED.value == "failed"


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TestTask:
    def test_creation(self):
        t = Task(
            task_id="task-001",
            task_type=TaskType.CONFIRM_TX,
            payload={"tx_hash": "0xABC"},
            status=TaskStatus.PENDING,
        )
        assert t.task_id == "task-001"
        assert t.task_type == TaskType.CONFIRM_TX
        assert t.payload["tx_hash"] == "0xABC"

    def test_to_dict(self):
        t = Task(
            task_id="task-002",
            task_type=TaskType.BRIDGE_RELAY,
            payload={"amount": "1000"},
            status=TaskStatus.COMPLETED,
        )
        d = t.to_dict()
        assert d["task_id"] == "task-002"
        assert d["task_type"] == "bridge_relay"
        assert d["status"] == "completed"


# ---------------------------------------------------------------------------
# InMemoryTaskQueue
# ---------------------------------------------------------------------------

class TestInMemoryTaskQueue:
    def test_enqueue(self):
        q = InMemoryTaskQueue()
        task = q.enqueue(
            task_type=TaskType.CONFIRM_TX,
            payload={"tx_hash": "0x123"},
        )
        assert task.task_id is not None
        assert task.status == TaskStatus.PENDING

    def test_dequeue(self):
        q = InMemoryTaskQueue()
        q.enqueue(TaskType.CONFIRM_TX, {"tx_hash": "0x1"})
        q.enqueue(TaskType.BRIDGE_RELAY, {"amount": "100"})

        task = q.dequeue()
        assert task is not None
        assert task.task_type == TaskType.CONFIRM_TX
        assert task.status == TaskStatus.RUNNING

    def test_dequeue_empty_returns_none(self):
        q = InMemoryTaskQueue()
        assert q.dequeue() is None

    def test_complete_task(self):
        q = InMemoryTaskQueue()
        task = q.enqueue(TaskType.CONFIRM_TX, {"tx_hash": "0x1"})
        q.dequeue()  # mark running

        completed = q.complete(task.task_id, result={"fee_wei": "21000"})
        assert completed.status == TaskStatus.COMPLETED
        assert completed.result == {"fee_wei": "21000"}

    def test_fail_task(self):
        q = InMemoryTaskQueue()
        task = q.enqueue(TaskType.CONFIRM_TX, {"tx_hash": "0x1"})
        q.dequeue()

        failed = q.fail(task.task_id, error="timeout")
        assert failed.status == TaskStatus.FAILED
        assert failed.error == "timeout"

    def test_get_task(self):
        q = InMemoryTaskQueue()
        task = q.enqueue(TaskType.CONFIRM_TX, {"tx_hash": "0x1"})

        fetched = q.get(task.task_id)
        assert fetched is not None
        assert fetched.task_id == task.task_id

    def test_get_nonexistent(self):
        q = InMemoryTaskQueue()
        assert q.get("nope") is None

    def test_pending_count(self):
        q = InMemoryTaskQueue()
        q.enqueue(TaskType.CONFIRM_TX, {})
        q.enqueue(TaskType.BRIDGE_RELAY, {})
        q.enqueue(TaskType.ICM_DELIVER, {})

        assert q.pending_count() == 3

        q.dequeue()
        assert q.pending_count() == 2

    def test_list_by_type(self):
        q = InMemoryTaskQueue()
        q.enqueue(TaskType.CONFIRM_TX, {})
        q.enqueue(TaskType.BRIDGE_RELAY, {})
        q.enqueue(TaskType.CONFIRM_TX, {})

        confirm_tasks = q.list_by_type(TaskType.CONFIRM_TX)
        assert len(confirm_tasks) == 2

    def test_fifo_order(self):
        q = InMemoryTaskQueue()
        t1 = q.enqueue(TaskType.CONFIRM_TX, {"order": 1})
        t2 = q.enqueue(TaskType.CONFIRM_TX, {"order": 2})
        t3 = q.enqueue(TaskType.CONFIRM_TX, {"order": 3})

        assert q.dequeue().payload["order"] == 1
        assert q.dequeue().payload["order"] == 2
        assert q.dequeue().payload["order"] == 3

    def test_retry_failed_task(self):
        q = InMemoryTaskQueue()
        task = q.enqueue(TaskType.CONFIRM_TX, {"tx_hash": "0x1"})
        q.dequeue()
        q.fail(task.task_id, error="network error")

        retried = q.retry(task.task_id)
        assert retried.status == TaskStatus.PENDING
        assert retried.error is None
        assert retried.retry_count == 1

    def test_max_retries(self):
        q = InMemoryTaskQueue(max_retries=2)
        task = q.enqueue(TaskType.CONFIRM_TX, {})

        # Retry 1
        q.dequeue()
        q.fail(task.task_id, error="err")
        q.retry(task.task_id)

        # Retry 2
        q.dequeue()
        q.fail(task.task_id, error="err")
        q.retry(task.task_id)

        # Retry 3 should fail
        q.dequeue()
        q.fail(task.task_id, error="err")
        with pytest.raises(ValueError, match="max retries"):
            q.retry(task.task_id)


# ---------------------------------------------------------------------------
# TaskQueue protocol compliance
# ---------------------------------------------------------------------------

class TestTaskQueueProtocol:
    def test_inmemory_implements_protocol(self):
        q: TaskQueue = InMemoryTaskQueue()
        # Should not raise — duck typing
        task = q.enqueue(TaskType.CONFIRM_TX, {})
        assert task.status == TaskStatus.PENDING


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
